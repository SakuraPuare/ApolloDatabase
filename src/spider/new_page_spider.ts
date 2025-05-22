#!/usr/bin/env node

import { Index as MeiliIndex } from "meilisearch"; // 只导入 Index
import {
  sleep,
  DELAY_MIN_MS,
  processArticleId, // 导入 processArticleId
} from "../utils/shared_utils";

import { ArticleDocument, ProcessArticleResultStatus } from "@/lib/types";

// 从 lib/meilisearch 导入 MeiliSearch 相关的常量和函数
import { addDocumentsWithRetry, getOrCreateIndex } from "../lib/meilisearch";

// --- 配置参数 ---
const DEFAULT_START_ID = 1000; // 默认开始 ID（如果索引为空）
const MAX_ID = 3000; // 尝试到的最大 ID（需要根据观察调整）
const CONSECUTIVE_FAILURE_LIMIT = 50; // 连续多少个失败后停止
const CONCURRENCY = 20; // 并行爬取的数量
const BATCH_SIZE = 20; // 批量处理的 ID 数量
const INDEX_NAME = "apollo_articles";

// 获取当前索引中的最大 ID
async function getMaxExistingId(
  index: MeiliIndex<ArticleDocument>,
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
  let index: MeiliIndex<ArticleDocument>;
  try {
    // 使用从 meilisearch.ts 导入的 getOrCreateIndex，并指定泛型类型
    index = await getOrCreateIndex<ArticleDocument>(INDEX_NAME);

    // 获取当前最大 ID
    const maxExistingId = Math.max(
      await getMaxExistingId(index),
      DEFAULT_START_ID,
    );
    const startId = maxExistingId + 1;

    let consecutiveFailures = 0;
    let newArticlesCount = 0;
    let notFoundCount = 0; // ProcessArticleResultStatus.NotFound 计数
    let otherErrorCount = 0; // ProcessArticleResultStatus.FetchError 或 OtherHttpError 计数

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

      if (idsToProcess.length === 0) {
        console.log(`ID 范围 ${batchStart}-${batchEnd} 无需处理，跳过。`);
        continue; // 跳过空批次
      }

      console.log(`开始处理 ID 范围：${batchStart}-${batchEnd}...`);

      const articles: ArticleDocument[] = []; // 存储成功获取的文章

      // 分批并行处理 IDs
      for (let i = 0; i < idsToProcess.length; i += CONCURRENCY) {
        const chunk = idsToProcess.slice(i, i + CONCURRENCY);
        process.stdout.write(
          `\r处理 ID ${chunk[0]} 到 ${chunk[chunk.length - 1]}... `,
        );

        const promises = chunk.map(async (id) => {
          const result = await processArticleId(id);

          switch (result.status) {
            case ProcessArticleResultStatus.Success:
              process.stdout.write(
                `\r✓ ID ${id} 成功获取 ${result.article?.title?.substring(0, 15)}... `,
              );
              return result.article; // 返回文章数据
            case ProcessArticleResultStatus.NotFound:
              process.stdout.write(`\r- ID ${id} 未找到。`);
              consecutiveFailures++; // 404/500 计入连续失败
              notFoundCount++;
              return null; // 未找到
            case ProcessArticleResultStatus.FetchError:
              process.stdout.write(`\r✗ ID ${id} 抓取失败（网络/解析错误）。`);
              otherErrorCount++;
              return null; // 抓取失败
            case ProcessArticleResultStatus.OtherHttpError:
              process.stdout.write(`\r✗ ID ${id} HTTP 错误。`);
              otherErrorCount++;
              return null; // 其他 HTTP 错误
            default:
              process.stdout.write(`\r? ID ${id} 未知状态。`);
              return null;
          }
        });

        // 等待当前并行批次完成
        const results = await Promise.all(promises);

        // 收集成功的结果并重置连续失败计数
        results.forEach((article) => {
          if (article) {
            articles.push(article);
            consecutiveFailures = 0; // 有成功就重置失败计数
          }
        });

        console.log(""); // 换行，避免下一行输出覆盖当前进度

        // 检查连续失败次数
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
          console.log(
            `\n已连续遇到 ${CONSECUTIVE_FAILURE_LIMIT} 次失败 (${notFoundCount}个未找到，${otherErrorCount}个其他错误)，停止尝试更多 ID。`,
          );
          break; // 退出并行批次循环
        }

        // 批次间的短暂延迟
        await sleep(DELAY_MIN_MS);
      }

      // 检查是否因为连续失败而提前停止了并行批次处理
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        break; // 退出主批次循环
      }

      // 批量添加文档到索引 (在处理完当前 batchStart 到 batchEnd 的所有 ID 后进行)
      if (articles.length > 0) {
        try {
          console.log(`批量添加 ${articles.length} 篇文章到 MeiliSearch...`);
          // articles 已经是 ArticleDocument[] 类型，无需断言
          await addDocumentsWithRetry(INDEX_NAME, articles);
          newArticlesCount += articles.length;
          console.log(`成功添加 ${articles.length} 篇文章到索引。`);
        } catch (error) {
          console.error(`批量添加文档失败:`, error);
          // 这里可以决定是否停止整个脚本或继续
        }
      } else {
        console.log(`范围 ${batchStart}-${batchEnd} 没有成功抓取到新文章.`);
      }
    }

    console.log(
      `\n新文章检查完成。本次运行共向 MeiliSearch 添加了 ${newArticlesCount} 篇新文章。`,
    );
    console.log(
      `错误统计：未找到 (404/500): ${notFoundCount}次，抓取/其他错误：${otherErrorCount}次`,
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
