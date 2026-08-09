import { create, insertMultiple, save } from "@orama/orama";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DUMP_PATH = join(__dirname, "../data/20250427-153952737.dump");
const OUTPUT_DIR = join(__dirname, "../public/search-index");
const TEMP_DIR = "/tmp/meili-dump-build";

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

async function buildIndex() {
  console.log("Extracting Meilisearch dump...");
  execSync(`rm -rf ${TEMP_DIR} && mkdir -p ${TEMP_DIR}`);
  execSync(`tar -xzf ${DUMP_PATH} -C ${TEMP_DIR}`);

  const docsPath = join(TEMP_DIR, "indexes/articles/documents.jsonl");
  const lines = readFileSync(docsPath, "utf-8").trim().split("\n");

  console.log(`Found ${lines.length} documents`);

  const articles = lines.map((line) => {
    const doc = JSON.parse(line);
    const fullContent = stripHtml(doc.content || "");
    return {
      id: String(doc.id),
      title: doc.title || "",
      content: fullContent.slice(0, 1000),
      url: doc.url || "",
      author: doc.author || "",
      publishTimestamp: doc.publishTimestamp || 0,
      publishDateStr: doc.publishDateStr || "",
      views: doc.views || 0,
      likes: doc.likes || 0,
    };
  });

  console.log("Creating Orama index...");
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

  insertMultiple(db, articles);
  console.log(`Indexed ${articles.length} articles`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const serialized = save(db);
  const indexJson = JSON.stringify(serialized);
  writeFileSync(join(OUTPUT_DIR, "articles.json"), indexJson);
  console.log(
    `Index written: ${(indexJson.length / 1024 / 1024).toFixed(1)} MB`
  );

  // Also write a metadata file
  writeFileSync(
    join(OUTPUT_DIR, "meta.json"),
    JSON.stringify({
      totalArticles: articles.length,
      builtAt: new Date().toISOString(),
      dumpDate: "2025-04-27",
    })
  );

  // Clean up
  execSync(`rm -rf ${TEMP_DIR}`);
  console.log("Done!");
}

buildIndex().catch(console.error);
