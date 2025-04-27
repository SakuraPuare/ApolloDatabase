#!/usr/bin/env node

import { Index, MeiliSearchApiError } from "meilisearch";
import {
  ArticleDocument,
  INDEX_NAME,
  sleep,
  fetchAndParseArticle,
  getOrCreateIndex,
  DELAY_MIN_MS,
  DELAY_MAX_MS,
  addDocumentsWithRetry,
} from "../utils/shared_utils.js";

// --- 配置参数 ---
const DEFAULT_START_ID = 1; // 默认开始 ID（如果索引为空）
const MAX_ID = 3000; // 尝试到的最大 ID（需要根据观察调整）
const CONSECUTIVE_FAILURE_LIMIT = 50; // 连续多少个失败后停止
const CONCURRENCY = 20; // 并行爬取的数量
const BATCH_SIZE = 20; // 批量处理的 ID 数量

// 获取当前索引中的最大 ID
async function getMaxExistingId(
  index: Index<ArticleDocument>,
): Promise<number> {
  try {
    const docs = await index.search("", {
      limit: 1,
      sort: ["id:desc"],
    });

    if (docs.hits.length > 0) {
      const maxId = docs.hits[0].id;
      console.log(`找到最大现有 ID: ${maxId}`);
      return maxId;
    }
  } catch (error) {
    console.error("获取最大 ID 时出错：", error);
  }

  console.log(`未找到现有文章，将从 ID ${DEFAULT_START_ID} 开始爬取`);
  return DEFAULT_START_ID - 1; // 返回默认值减 1，因为我们会从 maxId+1 开始
}

// 主函数
async function main() {
  let index: Index<ArticleDocument>;
  try {
    index = await getOrCreateIndex(INDEX_NAME);
    await index.updateFilterableAttributes(["id"]);
    await index.updateSortableAttributes(["id"]);

    // 获取当前最大 ID
    const maxExistingId = await getMaxExistingId(index);
    const startId = maxExistingId + 1;

    let consecutiveFailures = 0;
    let newArticlesCount = 0;
    let notFoundCount = 0; // 404 计数
    let otherErrorCount = 0; // 其他错误计数

    console.log(`开始从 ID ${startId} 爬取新文章（并行度：${CONCURRENCY}）...`);

    // 直接从最大 ID 开始，按批次处理
    for (
      let batchStart = startId;
      batchStart <= MAX_ID;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, MAX_ID);
      const idsToProcess = Array.from(
        { length: batchEnd - batchStart + 1 },
        (_, i) => batchStart + i,
      );

      console.log(`开始处理 ID 范围：${batchStart}-${batchEnd}...`);

      // 并行爬取所有 ID
      const articles: ArticleDocument[] = [];

      // 分批并行处理
      for (let i = 0; i < idsToProcess.length; i += CONCURRENCY) {
        const batch = idsToProcess.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (id) => {
          let retryCount = 0;
          const maxRetries = 3;

          async function tryFetch(): Promise<ArticleDocument | null> {
            try {
              process.stdout.write(`\r爬取 ID: ${id}... `);
              const result = await fetchAndParseArticle(id);

              if (result && result.status === 200 && result.data) {
                process.stdout.write(
                  `\r✓ ID ${id}: ${result.data.title?.substring(0, 20)}... `,
                );
                return {
                  id: result.data.id!,
                  url:
                    result.data.url ||
                    `https://apollo.baidu.com/community/article/${id}`,
                  title: result.data.title || "无标题",
                  content: result.data.content || null,
                  publishTimestamp: result.data.publishTimestamp || null,
                  publishDateStr: result.data.publishDateStr || "",
                  author: result.data.author || "未知作者",
                  views: result.data.views || 0,
                  likes: result.data.likes || 0,
                } as ArticleDocument;
              } else if (
                (result && result.status === 500) ||
                (result && result.status === 404)
              ) {
                // 500 就是没有找到
                consecutiveFailures++;
                notFoundCount++;
                process.stdout.write(`\r- ID ${id}: Not Found`);
                return null;
              } else {
                // 其他 HTTP 错误，不计入连续失败
                otherErrorCount++;
                process.stdout.write(
                  `\r✗ ID ${id}: HTTP 错误 ${result?.status ?? "N/A"}`,
                );
                return null;
              }
            } catch (error) {
              // 网络错误，尝试重试
              if (retryCount < maxRetries) {
                retryCount++;
                process.stdout.write(
                  `\r! ID ${id}: 网络错误，重试 (${retryCount}/${maxRetries})...`,
                );
                await sleep(1000 * retryCount); // 重试延迟递增
                return tryFetch();
              } else {
                // 达到最大重试次数
                otherErrorCount++;
                process.stdout.write(
                  `\r✗ ID ${id}: 网络错误，已重试 ${maxRetries} 次失败`,
                );
                return null;
              }
            }
          }

          return tryFetch();
        });

        // 等待当前批次完成
        const results = await Promise.all(promises);

        // 收集成功爬取的文章
        results.forEach((article) => {
          if (article) {
            articles.push(article);
            consecutiveFailures = 0; // 有成功就重置失败计数
          }
        });

        console.log(""); // 换行

        // 检查连续失败次数
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
          console.log(
            `\n已连续遇到 ${CONSECUTIVE_FAILURE_LIMIT} 次失败，停止尝试更多 ID。`,
          );
          console.log(
            `失败详情：404 错误：${notFoundCount}次，其他错误：${otherErrorCount}次`,
          );
          break;
        }

        // 批次间的短暂延迟
        await sleep(DELAY_MIN_MS);
      }

      // 批量添加文档到索引
      if (articles.length > 0) {
        try {
          console.log(`批量添加 ${articles.length} 篇文章到 MeiliSearch...`);
          await addDocumentsWithRetry(INDEX_NAME, articles);
          newArticlesCount += articles.length;
          console.log(`成功添加 ${articles.length} 篇文章到索引。`);
        } catch (error) {
          console.error(`批量添加文档失败:`, error);
        }
      }

      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        break;
      }
    }

    console.log(
      `\n新文章检查完成。本次运行共向 MeiliSearch 添加了 ${newArticlesCount} 篇新文章。`,
    );
    console.log(
      `错误统计：404 错误：${notFoundCount}次，其他错误：${otherErrorCount}次`,
    );
    console.log("脚本执行完毕。");
  } catch (error) {
    console.error("初始化 MeiliSearch 索引失败，脚本将退出。", error);
    return;
  }
}

// 判断脚本是否是直接被执行的
if (
  import.meta.url.startsWith("file://") &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  main();
}

// export { main };
