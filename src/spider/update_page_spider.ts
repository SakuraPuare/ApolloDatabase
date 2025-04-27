#!/usr/bin/env node

import { Index } from "meilisearch";
import {
  ArticleDocument,
  INDEX_NAME,
  sleep,
  fetchAndParseArticle,
  getOrCreateIndex,
  DELAY_MIN_MS,
  DELAY_MAX_MS,
} from "../utils/shared_utils.js";

// --- 配置参数 ---
const MAX_DOCUMENTS_PER_FETCH = 1000; // 一次从 MeiliSearch 获取多少文档 ID
const MAX_TOTAL_DOCUMENTS_TO_UPDATE = 100000; // 防止无限循环或获取过多文档

// 主函数
async function main() {
  let index: Index<ArticleDocument>;
  try {
    index = await getOrCreateIndex(INDEX_NAME);
  } catch (error) {
    console.error("初始化 MeiliSearch 索引失败，脚本将退出。");
    return;
  }

  let allArticleIds: number[] = [];
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
  } catch (error: any) {
    console.error(`\n从 MeiliSearch 获取文档 ID 时出错：${error.message}`);
    if (error.code === "meilisearch_communication_error") {
      console.error("无法连接到 MeiliSearch，脚本将停止。");
    }
    return; // 停止脚本
  }

  process.stdout.write("\n"); // 换行
  console.log(`共获取到 ${allArticleIds.length} 个文章 ID，开始逐个更新...`);

  let updatedCount = 0;
  let fetchFailedCount = 0;
  let updateFailedCount = 0;

  for (let i = 0; i < allArticleIds.length; i++) {
    const id = allArticleIds[i];
    const progress = `(${i + 1}/${allArticleIds.length})`;

    process.stdout.write(`\r${progress} 尝试更新 ID: ${id}... `);

    const fetchResult = await fetchAndParseArticle(id);

    if (fetchResult && fetchResult.status === 200 && fetchResult.data) {
      // 成功获取文章数据
      process.stdout.write(
        `\r${progress} 成功获取 ID: ${id} - ${fetchResult.data.title?.substring(0, 20)}... `,
      );

      const meiliDoc: ArticleDocument = {
        id: fetchResult.data.id!,
        url:
          fetchResult.data.url ||
          `https://apollo.baidu.com/community/article/${id}`,
        title: fetchResult.data.title || "无标题",
        content: fetchResult.data.content || null,
        publishTimestamp: fetchResult.data.publishTimestamp || null,
        publishDateStr: fetchResult.data.publishDateStr || "",
        author: fetchResult.data.author || "未知作者",
        views: fetchResult.data.views || 0,
        likes: fetchResult.data.likes || 0,
      };

      // 使用 updateDocuments 更新 MeiliSearch
      try {
        // 注意：updateDocuments 也是批量的，但这里我们一次只更新一个
        const taskResponse = await index.updateDocuments([meiliDoc]); // updateDocuments also returns a task object
        updatedCount++;
        process.stdout.write(` (已提交更新)`);
        // 可选：等待任务完成
        // await meiliClient.waitForTask(taskResponse.taskUid, { timeOutMs: 10000 });
      } catch (meiliError: any) {
        updateFailedCount++;
        console.error(
          `\n -> 更新 ID ${id} 到 MeiliSearch 失败:`,
          meiliError.message,
        );
        if (meiliError.code === "meilisearch_communication_error") {
          console.error("无法连接到 MeiliSearch，脚本将停止。");
          return; // 停止脚本
        }
        // 其他 MeiliSearch 错误，记录并继续
        process.stdout.write(` (更新失败)`);
      }
    } else {
      // 爬取失败 (404 或其他错误)
      fetchFailedCount++;
      const statusMsg = fetchResult
        ? `状态 ${fetchResult.status}`
        : "网络/解析错误";
      console.warn(
        `\n -> ${progress} 爬取已存在索引的 ID ${id} 失败 (${statusMsg})。文章可能已被删除或无法访问。`,
      );
      // 可选：考虑是否从 MeiliSearch 中删除此文档
      process.stdout.write(` (爬取失败)`);
    }

    // 添加随机延迟
    const delay = Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS) + DELAY_MIN_MS;
    await sleep(delay);

    // 清除行尾可能残留的字符
    // process.stdout.write("\r" + " ".repeat(process.stdout.columns) + "\r");
  }
  process.stdout.write("\n"); // 结束进度条输出，换行

  console.log(`\n文章更新完成。`);
  console.log(` - 成功提交更新: ${updatedCount}`);
  console.log(` - 爬取失败 (文章可能不存在了): ${fetchFailedCount}`);
  console.log(` - MeiliSearch 更新操作失败: ${updateFailedCount}`);
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
