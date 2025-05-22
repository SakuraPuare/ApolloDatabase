import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import readline from "readline";
import crypto from "crypto";
import puppeteer, { Browser } from "puppeteer";
import { MeiliSearch, Index as MeiliIndex } from "meilisearch";

// 导入 MeiliSearch 相关的常量和函数
import { getOrCreateIndex, addDocumentsWithRetry } from "@/lib/meilisearch";

import { sleep, DELAY_MIN_MS } from "@/utils/shared_utils";

import { CrawledPageDocument } from "@/lib/types";

// 配置
const BASE_URL = "https://apollo.baidu.com/docs/apollo/latest/index.html";
const OUTPUT_DIR = path.join(process.cwd(), "data", "apollo-docs");
const COOKIES_FILE = path.join(process.cwd(), "data", "apollo-cookies.json");
const BASE_HOSTNAME = new URL(BASE_URL).hostname;

// 新增黑名单配置
const BLACKLISTED_PATHS: string[] = [
  "/workspace", // 例如：屏蔽 /workspace 下的所有页面
  // 可以根据需要添加更多路径前缀，例如 '/community/user/'
  // 确保路径以 '/' 开头，如果它们是相对于根路径的
];

// URL 追踪索引名
const URL_INDEX_NAME = "apollo_crawled_urls"; // 专门用于追踪已爬取的 URL
const DOCS_INDEX_NAME = "apollo_docs";

interface PageData {
  id: string; // 使用 URL 的 MD5 哈希作为 ID
  url: string;
  title: string;
  content: string;
  links: string[];
  crawledAt: string;
}

interface CrawledUrlRecord {
  id: string; // URL 的 MD5 哈希值
  url: string;
  status: "crawled" | "queued" | "error";
  crawledAt?: string;
  errorMessage?: string;
}

// URL 队列 - 仅用于内存中管理
const urlQueue: string[] = [];

/**
 * 生成 URL 的唯一 ID（简单 MD5 哈希）
 */
function generateUrlId(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex");
}

// MeiliSearch Client Instance getter
async function getMeiliClient(): Promise<MeiliSearch> {
  const meiliHost = process.env.MEILI_HOST || "http://localhost:7700";
  const meiliApiKey = process.env.MEILI_API_KEY || "";
  return new MeiliSearch({ host: meiliHost, apiKey: meiliApiKey });
}

// Typed accessor for URL tracking index
async function getTypedUrlIndex(): Promise<MeiliIndex<CrawledUrlRecord>> {
  const client = await getMeiliClient();
  // Assumes initializeUrlIndex has created and configured it.
  return client.index<CrawledUrlRecord>(URL_INDEX_NAME);
}

/**
 * 检查 URL 是否在黑名单中
 */
function isUrlBlacklisted(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // 只检查同域名的 URL
    if (urlObj.hostname === BASE_HOSTNAME) {
      return BLACKLISTED_PATHS.some((blacklistedPath) =>
        urlObj.pathname.startsWith(blacklistedPath),
      );
    }
    return false; // 非同域名 URL 不在检查范围内，可根据需求调整
  } catch (error) {
    console.warn(
      `解析 URL 时出错 (isUrlBlacklisted): ${url}`,
      error instanceof Error ? error.message : error,
    );
    return true; // 解析失败的 URL 默认视为黑名单，避免爬取
  }
}

/**
 * 初始化 URL 追踪索引
 */
async function initializeUrlIndex() {
  try {
    const client = await getMeiliClient();

    // For DOCS_INDEX_NAME, use the imported getOrCreateIndex with specific type
    const docsIndex =
      await getOrCreateIndex<CrawledPageDocument>(DOCS_INDEX_NAME);
    console.log(`文档索引 ${DOCS_INDEX_NAME} 初始化成功`);

    // For URL_INDEX_NAME, handle creation and configuration here
    let urlIndex: MeiliIndex<CrawledUrlRecord>;
    try {
      urlIndex = client.index<CrawledUrlRecord>(URL_INDEX_NAME);
      await urlIndex.getRawInfo(); // Check existence
      console.log(`URL 追踪索引 ${URL_INDEX_NAME} 已存在。`);
    } catch (error: unknown) {
      // 根据错误日志，'index_not_found' 状态码在 error.cause.code 中
      // MeiliSearch API errors often have a 'cause' property with more details.
      const cause = (error as { cause?: { code?: string } })?.cause;
      if (cause?.code === "index_not_found") {
        console.log(
          `URL 追踪索引 ${URL_INDEX_NAME} 不存在，正在创建 (主键：id)...`,
        );
        const task = await client.createIndex(URL_INDEX_NAME, {
          primaryKey: "id",
        });
        // The line below uses client.tasks.waitForTask, which is a standard way to wait for a task in recent MeiliSearch SDKs.
        // If you encounter type errors here, ensure your MeiliSearch SDK and its type definitions are up-to-date.
        await client.tasks.waitForTask(task.taskUid);
        urlIndex = client.index<CrawledUrlRecord>(URL_INDEX_NAME); // Re-fetch after creation
        console.log(`URL 追踪索引 ${URL_INDEX_NAME} 创建成功。`);
      } else {
        console.error(`检查或创建 URL 追踪索引 ${URL_INDEX_NAME} 失败:`, error);
        throw error;
      }
    }
    await urlIndex.updateFilterableAttributes(["status", "crawledAt"]);
    console.log(`URL 追踪索引 ${URL_INDEX_NAME} 初始化并配置完成。`);

    return { docsIndex, urlIndex };
  } catch (error) {
    console.error("初始化索引失败：", error);
    throw error;
  }
}

/**
 * 检查 URL 是否已经爬取过
 */
async function isUrlCrawled(url: string): Promise<boolean> {
  try {
    const urlId = generateUrlId(url);
    const index = await getTypedUrlIndex();

    try {
      await index.getDocument(urlId);
      return true; // 文档存在，表示 URL 已被处理
    } catch (e: unknown) {
      // MeiliSearch errors often have a 'code' property.
      if ((e as { code?: string })?.code === "document_not_found") {
        return false; // 文档不存在，URL 未被处理
      }
      throw e; // 重新抛出其他错误
    }
  } catch (error) {
    console.error(`检查 URL 状态失败：${url}`, error);
    return false; // 出错时保守处理，假设未爬取过
  }
}

/**
 * 标记 URL 为已入队列
 */
async function markUrlAsQueued(url: string) {
  try {
    const urlRecord: CrawledUrlRecord = {
      id: generateUrlId(url),
      url,
      status: "queued",
    };

    const index = await getTypedUrlIndex();
    await index.addDocuments([urlRecord]);
  } catch (error) {
    console.error(`将 URL 标记为已入队列失败：${url}`, error);
  }
}

/**
 * 标记 URL 为已爬取或出错
 */
async function updateUrlStatus(
  url: string,
  status: "crawled" | "error",
  errorMessage?: string,
) {
  try {
    const urlRecord: CrawledUrlRecord = {
      id: generateUrlId(url),
      url,
      status,
      crawledAt: new Date().toISOString(),
    };

    if (errorMessage) {
      urlRecord.errorMessage = errorMessage;
    }

    const index = await getTypedUrlIndex();
    await index.updateDocuments([urlRecord]);
  } catch (error) {
    console.error(`更新 URL 状态失败：${url}`, error);
  }
}

/**
 * 获取用户 Cookie 的函数
 */
async function getCookies(): Promise<string> {
  // 检查是否已有保存的 Cookie
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
      const lastUpdated = new Date(cookieData.timestamp);
      const now = new Date();

      // 检查 Cookie 是否在 7 天内
      if (now.getTime() - lastUpdated.getTime() < 7 * 24 * 60 * 60 * 1000) {
        console.log("使用已保存的Cookie");
        return cookieData.cookies;
      }
    } catch (error: unknown) {
      console.error(
        "读取Cookie文件失败:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 如果没有有效的Cookie，提示用户登录
  console.log("\n=== Apollo文档爬虫 ===");
  console.log("请按照以下步骤操作:");
  console.log(
    "1. 打开浏览器，访问 https://apollo.baidu.com/community/Apollo-Homepage-Document",
  );
  console.log("2. 完成登录");
  console.log("3. 在浏览器开发者工具中，找到Network标签");
  console.log("4. 刷新页面，选择任意一个请求");
  console.log('5. 在Headers中找到"Cookie"字段，复制整个值');
  console.log("6. 粘贴到下方提示处\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("请粘贴 Cookie 值：", (cookies) => {
      rl.close();

      // 保存 Cookie 到文件
      const cookieData = {
        cookies,
        timestamp: new Date().toISOString(),
      };

      if (!fs.existsSync(path.dirname(COOKIES_FILE))) {
        fs.mkdirSync(path.dirname(COOKIES_FILE), { recursive: true });
      }

      fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookieData, null, 2));
      console.log("Cookie 已保存");

      resolve(cookies);
    });
  });
}

/**
 * 爬取单个页面
 */
async function crawlPage(
  url: string,
  cookieHeader: string,
  browser: Browser,
): Promise<PageData | null> {
  const page = await browser.newPage();
  try {
    console.log(`正在使用 Puppeteer 爬取：${url}`);

    const headersToSet: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    };
    if (cookieHeader) {
      headersToSet["Cookie"] = cookieHeader;
    }
    await page.setExtraHTTPHeaders(headersToSet);

    // 增加超时设置，并等待网络空闲，以确保动态内容加载
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    const htmlContent = await page.content(); // 获取由 JS 渲染后的完整 HTML

    // 使用 JSDOM 解析 HTML
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // 提取页面标题
    const title = document.querySelector("title")?.textContent || "未知标题";

    // 提取主要内容区域
    // 注意：这里的选择器需要根据实际网页结构调整
    const contentElement =
      document.querySelector(".article-content") ||
      document.querySelector("main") ||
      document.querySelector("body");

    const content = contentElement ? contentElement.innerHTML : ""; // 获取 innerHTML 以保留格式

    // 提取页面中的链接
    const links: string[] = [];
    const linkElements = document.querySelectorAll("a");

    linkElements.forEach((link: Element) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        try {
          // 使用当前页面 URL (url) 作为基准来解析相对路径
          const resolvedUrl = new URL(href, url);

          // 只保留同域名下 (BASE_HOSTNAME) 的 HTTP/HTTPS 协议链接
          if (
            (resolvedUrl.protocol === "http:" ||
              resolvedUrl.protocol === "https:") &&
            resolvedUrl.hostname === BASE_HOSTNAME
          ) {
            const cleanUrl = resolvedUrl.href.split("#")[0]; // 移除 URL 片段
            if (!links.includes(cleanUrl)) {
              // 避免在当前页面重复添加链接
              links.push(cleanUrl);
            }
          }
        } catch (e) {
          // 可选：记录无效的 URL
          console.warn(
            `在页面 ${url} 上解析链接 "${href}" 失败:`,
            e instanceof Error ? e.message : e,
          );
        }
      }
    });

    return {
      id: generateUrlId(url),
      url,
      title,
      content,
      links,
      crawledAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error(`使用 Puppeteer 爬取页面失败：${url}`, error);
    await updateUrlStatus(
      url,
      "error",
      error instanceof Error ? error.message : "未知错误",
    );
    return null;
  } finally {
    await page.close(); // 确保页面被关闭
  }
}

/**
 * 保存页面数据到索引
 */
async function savePage(pageData: PageData): Promise<boolean> {
  try {
    // 1. 构建要保存到 MeiliSearch 的文档
    const documentToSave: CrawledPageDocument = {
      id: pageData.id, // pageData.id 是 URL 的 MD5 哈希字符串
      url: pageData.url,
      title: pageData.title,
      content: pageData.content, // 保存原始 HTML 内容
      crawledAt: pageData.crawledAt,
    };

    // 保存到文档索引 (DOCS_INDEX_NAME)，使用 addDocumentsWithRetry 函数
    // documentToSave 是 CrawledPageDocument 类型，符合 addDocumentsWithRetry 的泛型约束
    await addDocumentsWithRetry(
      DOCS_INDEX_NAME,
      [documentToSave], // 确保是数组
    );

    // 2. 更新 URL 状态为已爬取
    await updateUrlStatus(pageData.url, "crawled");

    // 3. 将链接加入队列（如果未处理过且不在黑名单中）
    for (const link of pageData.links) {
      if (isUrlBlacklisted(link)) {
        console.log(`链接在黑名单中，跳过添加至队列：${link}`);
        continue;
      }
      if (!(await isUrlCrawled(link)) && !urlQueue.includes(link)) {
        urlQueue.push(link);
        await markUrlAsQueued(link);
      }
    }

    // 4. 同时保存到本地文件
    const urlObj = new URL(pageData.url);
    const pathName = urlObj.pathname.replace(/\//g, "_");
    const fileName = `${pathName || "index"}.html`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    // 确保输出目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 构建 HTML 文件
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageData.title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${pageData.title}</h1>
  <div class="content">
    ${pageData.content}
  </div>
  <hr>
  <div class="metadata">
    <p>原始 URL: <a href="${pageData.url}">${pageData.url}</a></p>
    <p>爬取时间：${pageData.crawledAt}</p>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(filePath, html);
    console.log(`保存页面：${filePath}`);

    return true;
  } catch (error: unknown) {
    console.error(`保存页面失败：${pageData.url}`, error);
    await updateUrlStatus(
      pageData.url,
      "error",
      error instanceof Error ? error.message : "未知错误",
    );
    return false;
  }
}

/**
 * 从索引中恢复队列状态
 */
async function restoreQueueFromIndex(): Promise<string[]> {
  try {
    const index = await getTypedUrlIndex();
    const response = await index.search<CrawledUrlRecord>("", {
      filter: "status = queued",
      limit: 1000,
    });

    const queuedUrls = response.hits.map((hit: CrawledUrlRecord) => hit.url);
    console.log(`从索引恢复了 ${queuedUrls.length} 个待爬取 URL`);
    return queuedUrls;
  } catch (error) {
    console.error("从索引恢复队列状态失败：", error);
    return [];
  }
}

/**
 * 爬虫主函数
 */
async function startCrawler() {
  let browser: Browser | null = null; // 定义 Puppeteer browser 实例
  try {
    // 初始化 Puppeteer
    console.log("初始化 Puppeteer...");
    browser = await puppeteer.launch({
      headless: true, // 使用无头模式
      // args: ['--no-sandbox', '--disable-setuid-sandbox'] // 在某些 CI/Docker 环境下可能需要
    });
    console.log("Puppeteer 初始化成功");

    // 初始化索引
    await initializeUrlIndex();

    // 获取 Cookie
    const cookies = await getCookies(); // 这是 cookie 字符串

    // 恢复之前中断的队列状态
    const queuedUrls = await restoreQueueFromIndex();
    urlQueue.push(...queuedUrls.filter((url) => !isUrlBlacklisted(url))); // 恢复时也过滤黑名单

    // 如果队列为空，添加入口 URL
    if (urlQueue.length === 0 && BASE_URL) {
      if (isUrlBlacklisted(BASE_URL)) {
        console.log(
          `入口 URL ${BASE_URL} 在黑名单中，爬虫无法基于此入口启动。`,
        );
        if (browser) {
          console.log("正在关闭 Puppeteer...");
          await browser.close();
          console.log("Puppeteer 已关闭");
        }
        return; // 如果基础 URL 在黑名单中，则退出
      }

      if (!(await isUrlCrawled(BASE_URL))) {
        urlQueue.push(BASE_URL);
        await markUrlAsQueued(BASE_URL);
      }
    }

    // 开始爬取
    console.log("开始爬取 Apollo 文档...");

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    while (urlQueue.length > 0) {
      const url = urlQueue.shift()!;

      // 再次检查是否已爬取（可能在队列中有重复或已被其他过程标记）
      // 注意：isUrlCrawled 检查的是 status=crawled 或 status=error 的文档是否存在
      // 如果一个 URL 之前被标记为 queued 但未成功爬取，它应该被重新尝试
      // 因此，我们主要关心的是，如果一个 URL 被明确标记为 crawled 了，就跳过。
      // 或者，如果因为错误太多次，我们也可以决定跳过 (但这需要更复杂的逻辑)。
      // 简单的 isUrlCrawled 检查已经包含了对 'crawled' 状态的判断，所以这里逻辑上可以简化。
      // 确保在 updateUrlStatus 中正确更新状态。

      const urlId = generateUrlId(url);
      const urlIndexInstance = await getTypedUrlIndex();
      let docStatus: CrawledUrlRecord | null = null;
      try {
        // urlIndexInstance is typed as MeiliIndex<CrawledUrlRecord>,
        // so getDocument(urlId) should return Promise<CrawledUrlRecord>.
        // The explicit cast `as CrawledUrlRecord` is generally not needed if types are correctly inferred.
        const documentData = await urlIndexInstance.getDocument(urlId);
        docStatus = documentData;
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "document_not_found") {
          docStatus = null; // 文档不存在是正常情况
        } else {
          console.warn(`从 URL 索引获取文档 ${urlId} 失败:`, e);
          // 可以考虑重试或跳过该 URL 的逻辑
        }
      }

      if (docStatus && docStatus.status === "crawled") {
        console.log(`URL 已成功爬取过，跳过：${url}`);
        continue;
      }

      // 爬取页面，传入 browser 实例和 cookie 字符串
      const pageData = await crawlPage(url, cookies, browser);
      processedCount++;

      // 保存页面
      if (pageData) {
        const saved = await savePage(pageData); // savePage 内部会调用 updateUrlStatus
        if (saved) {
          successCount++;
        } else {
          errorCount++;
          // savePage 内部出错时也会调用 updateUrlStatus('error')
        }
      } else {
        errorCount++;
        // crawlPage 返回 null 时，内部已调用 updateUrlStatus('error')
      }

      // 控制爬取速度
      await sleep(DELAY_MIN_MS);

      // 每处理 10 个 URL，输出一次状态
      if (processedCount % 10 === 0) {
        console.log(`----爬取进度----`);
        console.log(`已处理：${processedCount}`);
        console.log(`成功：${successCount}`);
        console.log(`失败：${errorCount}`);
        console.log(`队列中：${urlQueue.length}`);
        console.log(`--------------`);
      }
    }

    console.log("爬取完成！");
    console.log(`总共处理了 ${processedCount} 个 URL`);
    console.log(`成功爬取：${successCount}`);
    console.log(`失败：${errorCount}`);

    // 爬取完成后的统计数据
    const docsIndex =
      await getOrCreateIndex<CrawledPageDocument>(DOCS_INDEX_NAME);
    const stats = await docsIndex.getStats();
    console.log(`MeiliSearch 中共有 ${stats.numberOfDocuments} 篇文档`);
  } catch (error) {
    console.error("爬虫运行错误：", error);
  } finally {
    if (browser) {
      console.log("正在关闭 Puppeteer...");
      await browser.close();
      console.log("Puppeteer 已关闭");
    }
  }
}

/**
 * 调试函数：删除所有相关的 MeiliSearch 索引
 */
// async function debugDeleteIndices() {
//     console.log("--- 开始删除索引 ---");
//     try {
//         const client = await getMeiliClient();

//         try {
//             await client.deleteIndex(DOCS_INDEX_NAME);
//             console.log(`索引 ${DOCS_INDEX_NAME} 已成功删除。`);
//         } catch (error: unknown) {
//             if ((error as { code?: string })?.code === "index_not_found") {
//                 console.log(`索引 ${DOCS_INDEX_NAME} 不存在，无需删除。`);
//             } else {
//                 console.error(`删除索引 ${DOCS_INDEX_NAME} 失败:`, error);
//             }
//         }

//         // 2. 删除 URL 追踪索引 (URL_INDEX_NAME)
//         try {
//             await client.deleteIndex(URL_INDEX_NAME);
//             console.log(`索引 ${URL_INDEX_NAME} 已成功删除。`);
//         } catch (error: unknown) {
//             if ((error as { code?: string })?.code === "index_not_found") {
//                 console.log(`索引 ${URL_INDEX_NAME} 不存在，无需删除。`);
//             } else {
//                 console.error(`删除索引 ${URL_INDEX_NAME} 失败:`, error);
//             }
//         }

//         console.log("--- 索引删除操作完成 ---");
//     } catch (error) {
//         console.error("删除索引过程中发生错误：", error);
//     }
// }

// 如果需要执行删除操作，可以取消下面的注释并运行此文件：
// debugDeleteIndices().then(() => console.log('调试任务完成。')).catch(err => console.error('调试任务失败：', err));

// 执行爬虫
startCrawler();
