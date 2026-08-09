import axios from "axios";
import { load as cheerioLoad } from "cheerio";
import { create, insertMultiple, save } from "@orama/orama";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, "../public/search-index");
const CACHE_FILE = join(__dirname, "../data/articles-cache.json");

const CONCURRENCY = 15;
const MAX_ID = 5000;
const CONSECUTIVE_FAILURE_LIMIT = 50;

interface RawArticle {
  id: number;
  url: string;
  title: string;
  content: string;
  publishTimestamp: number;
  publishDateStr: string;
  author: string;
  views: number;
  likes: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchArticle(id: number): Promise<RawArticle | null> {
  const url = `https://apollo.baidu.com/community/article/${id}`;
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });

    if (res.status === 404 || res.status >= 400) return null;

    const $ = cheerioLoad(res.data);
    const title = $("h1").text().trim();
    if (!title) return null;

    const content = $(".style_article__content__richtext__1R31p").html() || "";
    const publishDateStr = $(
      ".style_article__content__follow__1TzQY span.style_marginright24__1REsu"
    )
      .text()
      .trim();
    const author = $(".style_author__name__3Rpg1").text().trim();
    const statsSpans = $(".style_article__content__follow__1TzQY span");
    const viewsText = statsSpans.eq(1).text().trim();
    const likesText = statsSpans.eq(2).find("span").last().text().trim();

    let publishTimestamp = 0;
    if (publishDateStr) {
      const isoStr = publishDateStr.includes(" ")
        ? publishDateStr.replace(" ", "T") + "Z"
        : publishDateStr;
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) publishTimestamp = Math.floor(d.getTime() / 1000);
    }

    return {
      id,
      url,
      title,
      content,
      publishTimestamp,
      publishDateStr,
      author: author || "未知作者",
      views: viewsText ? parseInt(viewsText.replace(/\D/g, ""), 10) || 0 : 0,
      likes: likesText ? parseInt(likesText, 10) || 0 : 0,
    };
  } catch (err: any) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return null;
    }
    throw err;
  }
}

async function crawlAll(): Promise<RawArticle[]> {
  let articles: Map<number, RawArticle> = new Map();
  if (existsSync(CACHE_FILE)) {
    const cached: RawArticle[] = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    for (const a of cached) articles.set(a.id, a);
    console.log(`Loaded ${articles.size} cached articles`);
  }

  const hasCache = articles.size > 0;

  if (hasCache) {
    // Incremental: scan from max existing ID upward
    const maxId = Math.max(...articles.keys());
    console.log(`Incremental mode: scanning from #${maxId + 1}`);
    let consecutiveFailures = 0;
    let id = maxId + 1;

    while (id <= MAX_ID && consecutiveFailures < CONSECUTIVE_FAILURE_LIMIT) {
      const batch: number[] = [];
      for (let i = 0; i < CONCURRENCY && id <= MAX_ID; i++, id++) {
        batch.push(id);
      }

      const results = await Promise.all(
        batch.map(async (articleId) => {
          try {
            return { id: articleId, article: await fetchArticle(articleId) };
          } catch {
            return { id: articleId, article: null };
          }
        })
      );

      for (const { id: aid, article } of results) {
        if (article) {
          articles.set(aid, article);
          consecutiveFailures = 0;
          process.stdout.write(`\r✓ new #${aid} (total: ${articles.size})`);
        } else {
          consecutiveFailures++;
        }
      }

      await sleep(300);
    }
  } else {
    // Full scan: first time, no cache
    console.log("Full scan mode: crawling all IDs 1-" + MAX_ID);
    let id = 1;

    while (id <= MAX_ID) {
      const batch: number[] = [];
      for (let i = 0; i < CONCURRENCY && id <= MAX_ID; i++, id++) {
        batch.push(id);
      }

      const results = await Promise.all(
        batch.map(async (articleId) => {
          try {
            return { id: articleId, article: await fetchArticle(articleId) };
          } catch {
            return { id: articleId, article: null };
          }
        })
      );

      for (const { id: aid, article } of results) {
        if (article) {
          articles.set(aid, article);
          process.stdout.write(`\r✓ ${articles.size} articles (latest: #${aid})`);
        }
      }

      await sleep(300);
    }
  }

  console.log(`\nCrawl complete: ${articles.size} articles total`);

  // Save cache
  const allArticles = Array.from(articles.values()).sort((a, b) => a.id - b.id);
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(allArticles));
  console.log(`Cache saved to ${CACHE_FILE}`);

  return allArticles;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildIndex(articles: RawArticle[]) {
  console.log("Building Orama index...");

  const docs = articles.map((a) => ({
    id: String(a.id),
    title: a.title,
    content: stripHtml(a.content).slice(0, 1000),
    url: a.url,
    author: a.author,
    publishTimestamp: a.publishTimestamp,
    publishDateStr: a.publishDateStr,
    views: a.views,
    likes: a.likes,
  }));

  const db = create({
    schema: {
      id: "string",
      title: "string",
      content: "string",
      url: "string",
      author: "string",
      publishTimestamp: "number",
      publishDateStr: "string",
      views: "number",
      likes: "number",
    } as const,
  });

  insertMultiple(db, docs);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const serialized = save(db);
  const indexJson = JSON.stringify(serialized);
  writeFileSync(join(OUTPUT_DIR, "articles.json"), indexJson);
  console.log(`Index: ${(indexJson.length / 1024 / 1024).toFixed(1)} MB`);

  writeFileSync(
    join(OUTPUT_DIR, "meta.json"),
    JSON.stringify({
      totalArticles: articles.length,
      builtAt: new Date().toISOString(),
    })
  );

  console.log("Done!");
}

async function main() {
  const articles = await crawlAll();
  await buildIndex(articles);
}

main().catch(console.error);
