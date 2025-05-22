#!/usr/bin/env node

import { Index as MeiliIndex } from "meilisearch";

// 从 shared_utils 导入通用的 utils 函数
import { sleep, DELAY_MIN_MS, processArticleId } from "../utils/shared_utils";

// 从 lib/meilisearch 导入 MeiliSearch 相关的常量和函数
import { getOrCreateIndex, addDocumentsWithRetry } from "../lib/meilisearch";

// 从 lib/types 导入类型和枚举
import { ArticleDocument, ProcessArticleResultStatus } from "@/lib/types";

// --- 配置参数 ---
const MAX_DOCUMENTS_PER_FETCH = 1000; // 一次从 MeiliSearch 获取多少文档 ID
const MAX_TOTAL_DOCUMENTS_TO_UPDATE = 100000; // 防止无限循环或获取过多文档
const CONCURRENCY = 20; // 并行爬取的数量
const BATCH_SIZE = 100; // 批量处理的 ID 数量
const INDEX_NAME = "apollo_articles";

// 主函数
async function main() {
  let index: MeiliIndex<ArticleDocument>;
  try {
    // 使用从 meilisearch.ts 导入的 getOrCreateIndex，并指定泛型类型
    index = await getOrCreateIndex<ArticleDocument>(INDEX_NAME);
  } catch {
    console.error("初始化 MeiliSearch 索引失败，脚本将退出。");
    return;
  }

  const allArticleIds: number[] = [];
  let offset = 0;
  let fetchedCount = 0;

  console.log(`开始从 MeiliSearch 索引 '${INDEX_NAME}' 获取现有文章 ID...`);

  try {
    while (fetchedCount < MAX_TOTAL_DOCUMENTS_TO_UPDATE) {
      const documents = await index.getDocuments<Pick<ArticleDocument, "id">>({
        fields: ["id"],
        limit: MAX_DOCUMENTS_PER_FETCH,
        offset: offset,
      });

      if (documents.results.length === 0) {
        console.log("已获取所有文档 ID。");
        break; // 没有更多文档了
      }

      const ids = documents.results.map((doc) => doc.id);
      allArticleIds.push(...ids);
      fetchedCount += ids.length;
      offset += MAX_DOCUMENTS_PER_FETCH;

      process.stdout.write(`\r已获取 ${fetchedCount} 个 ID...`);

      if (fetchedCount >= MAX_TOTAL_DOCUMENTS_TO_UPDATE) {
        console.warn(
          `\n已达到获取文档上限 (${MAX_TOTAL_DOCUMENTS_TO_UPDATE})，可能未获取所有文档。`,
        );
        break;
      }
    }
  } catch (error: unknown) {
    const err = error as { message: string; code?: string };
    console.error(`\n从 MeiliSearch 获取文档 ID 时出错：${err.message}`);
    if (err.code === "meilisearch_communication_error") {
      console.error("无法连接到 MeiliSearch，脚本将停止。");
    }
    return; // 停止脚本
  }

  process.stdout.write("\n"); // 换行
  console.log(
    `共获取到 ${allArticleIds.length} 个文章 ID，开始批量并行更新...`,
  );

  let updatedCount = 0;
  let fetchFailedCount = 0;
  let updateFailedCount = 0;

  // 按批次处理所有文章 ID
  for (
    let batchStart = 0;
    batchStart < allArticleIds.length;
    batchStart += BATCH_SIZE
  ) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, allArticleIds.length);
    const batchIds = allArticleIds.slice(batchStart, batchEnd);

    console.log(
      `开始处理批次 ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(allArticleIds.length / BATCH_SIZE)}，ID范围：${batchIds[0]}-${batchIds[batchIds.length - 1]}...`,
    );

    const updatedArticles: ArticleDocument[] = []; // 存储成功更新的文章

    // 分批并行处理 IDs
    for (let i = 0; i < batchIds.length; i += CONCURRENCY) {
      const chunk = batchIds.slice(i, i + CONCURRENCY);
      process.stdout.write(
        `\r处理 ID ${chunk[0]} 到 ${chunk[chunk.length - 1]}... `,
      );

      const promises = chunk.map(async (id) => {
        const progress = `(${batchStart + i + chunk.indexOf(id) + 1}/${allArticleIds.length})`;
        const result = await processArticleId(id);

        switch (result.status) {
          case ProcessArticleResultStatus.Success:
            process.stdout.write(
              `\r${progress} ✓ ID ${id} 成功获取 ${result.article?.title?.substring(0, 15)}... `,
            );
            return result.article; // 返回文章数据
          case ProcessArticleResultStatus.NotFound:
            process.stdout.write(`\r${progress} - ID ${id} 未找到。`);
            fetchFailedCount++;
            return null;
          case ProcessArticleResultStatus.FetchError:
            process.stdout.write(
              `\r${progress} ✗ ID ${id} 抓取失败（网络/解析错误）。`,
            );
            fetchFailedCount++;
            return null;
          case ProcessArticleResultStatus.OtherHttpError:
            process.stdout.write(`\r${progress} ✗ ID ${id} HTTP 错误。`);
            fetchFailedCount++;
            return null;
          default:
            process.stdout.write(`\r${progress} ? ID ${id} 未知状态。`);
            fetchFailedCount++;
            return null;
        }
      });

      // 等待当前并行批次完成
      const results = await Promise.all(promises);

      // 收集成功的结果
      results.forEach((article) => {
        if (article) {
          updatedArticles.push(article);
        }
      });

      console.log(""); // 换行，避免下一行输出覆盖当前进度

      // 批次间的短暂延迟
      await sleep(DELAY_MIN_MS);
    }

    // 批量更新文档到索引
    if (updatedArticles.length > 0) {
      try {
        console.log(
          `批量更新 ${updatedArticles.length} 篇文章到 MeiliSearch...`,
        );
        await addDocumentsWithRetry(INDEX_NAME, updatedArticles);
        updatedCount += updatedArticles.length;
        console.log(`成功更新 ${updatedArticles.length} 篇文章到索引。`);
      } catch (error) {
        console.error(`批量更新文档失败:`, error);
        updateFailedCount += updatedArticles.length;
      }
    } else {
      console.log(
        `批次 ${Math.floor(batchStart / BATCH_SIZE) + 1} 没有成功更新的文章。`,
      );
    }
  }

  console.log(`\n文章更新完成。`);
  console.log(` - 成功提交更新到 MeiliSearch: ${updatedCount}`);
  console.log(
    ` - 抓取失败 (文章可能不存在、网络或其他错误): ${fetchFailedCount}`,
  );
  console.log(` - 向 MeiliSearch 提交更新操作失败：${updateFailedCount}`);
  console.log("脚本执行完毕。");
}

// 判断脚本是否是直接被执行的
if (
  import.meta.url.startsWith("file://") &&
  process.argv[1] === new URL(import.meta.url).pathname
) {
  main();
}

// 确保导出
export { main };
