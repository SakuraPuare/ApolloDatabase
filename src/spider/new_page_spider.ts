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
} from "../utils/shared_utils.js";

// --- 配置参数 ---
const START_ID = 27; // 从哪个 ID 开始尝试
const MAX_ID = 3000; // 尝试到的最大 ID (需要根据观察调整)
const CONSECUTIVE_FAILURE_LIMIT = 50; // 连续多少个失败 (404 或错误) 后停止

// 主函数
async function main() {
    let index: Index<ArticleDocument>;
    try {
        index = await getOrCreateIndex(INDEX_NAME);
    } catch (error) {
        console.error("初始化 MeiliSearch 索引失败，脚本将退出。");
        return;
    }

    let consecutiveFailures = 0;
    let newArticlesCount = 0;

    console.log(`开始从 ID ${START_ID} 检查并添加新文章...`);

    for (let id = START_ID; id <= MAX_ID; id++) {
        let articleExists = false;
        try {
            // 1. 检查文章是否已在 MeiliSearch 中
            await index.getDocument(id);
            articleExists = true;
            process.stdout.write(`\rID: ${id} 已存在于索引中，跳过。`);
        } catch (error: any) {
            if (error instanceof MeiliSearchApiError) {
                const cause = error.cause;
                if (cause?.code === "document_not_found") {
                    // 文档不存在，这是我们期望处理的情况
                    articleExists = false;
                    process.stdout.write(`\r检查 ID: ${id} (未找到)... `);
                } else if (cause?.code === "meilisearch_communication_error") {
                    console.error(
                        `\n无法连接到 MeiliSearch (检查 ID: ${id})，脚本将停止。`,
                    );
                    return; // 停止脚本
                } else {
                    // 其他 MeiliSearch 错误
                    console.error(
                        `\n检查 MeiliSearch 中 ID ${id} 时出错: ${error.message}`,
                    );
                    consecutiveFailures++;
                    process.stdout.write(
                        `\rID: ${id} 检查出错 - 连续失败: ${consecutiveFailures}/${CONSECUTIVE_FAILURE_LIMIT}`,
                    );
                    if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
                        console.log(
                            `\n连续 MeiliSearch 错误达到 ${CONSECUTIVE_FAILURE_LIMIT} 次，停止。`,
                        );
                        break;
                    }
                    // 短暂延迟后继续尝试下一个
                    await sleep(DELAY_MIN_MS);
                    continue; // 跳过当前 ID 的后续处理
                }
            }

            // 2. 如果文章不存在，则尝试爬取
            if (!articleExists) {
                process.stdout.write(`\r尝试爬取 ID: ${id}... `);
                const fetchResult = await fetchAndParseArticle(id);

                if (
                    fetchResult &&
                    fetchResult.status === 200 &&
                    fetchResult.data
                ) {
                    // 成功获取文章数据
                    consecutiveFailures = 0; // 重置失败计数器
                    process.stdout.write(
                        `\r成功获取 ID: ${id} - ${fetchResult.data.title?.substring(0, 30)}... `,
                    );

                    const meiliDoc: ArticleDocument = {
                        id: fetchResult.data.id!, // id 肯定存在
                        url:
                            fetchResult.data.url ||
                            `https://apollo.baidu.com/community/article/${id}`,
                        title: fetchResult.data.title || "无标题",
                        content: fetchResult.data.content || null,
                        publishTimestamp:
                            fetchResult.data.publishTimestamp || null,
                        publishDateStr: fetchResult.data.publishDateStr || "",
                        author: fetchResult.data.author || "未知作者",
                        views: fetchResult.data.views || 0,
                        likes: fetchResult.data.likes || 0,
                    };

                    // 3. 添加到 MeiliSearch
                    try {
                        const taskResponse = await index.addDocuments([
                            meiliDoc,
                        ]);
                        newArticlesCount++;
                        process.stdout.write(` (已提交到 MeiliSearch)`);
                        // 可选：等待任务完成以确保写入
                        // await meiliClient.waitForTask(taskResponse.taskUid, { timeOutMs: 10000 });
                    } catch (meiliError: any) {
                        console.error(
                            `\n -> 添加 ID ${id} 到 MeiliSearch 失败:`,
                            meiliError.message,
                        );
                        if (
                            meiliError.code ===
                            "meilisearch_communication_error"
                        ) {
                            console.error(
                                "无法连接到 MeiliSearch，脚本将停止。",
                            );
                            return; // 停止脚本
                        }
                        // 其他 MeiliSearch 错误，记录并继续
                    }
                } else if (fetchResult && fetchResult.status === 404) {
                    // 爬取时 404
                    consecutiveFailures++;
                    process.stdout.write(
                        `\rID: ${id} (爬取 404) - 连续失败：${consecutiveFailures}/${CONSECUTIVE_FAILURE_LIMIT}`,
                    );
                } else {
                    // 爬取时发生其他错误或返回非 200/404 状态
                    consecutiveFailures++;
                    process.stdout.write(
                        `\rID: ${id} (爬取错误/无效 ${fetchResult?.status ?? "N/A"}) - 连续失败：${consecutiveFailures}/${CONSECUTIVE_FAILURE_LIMIT}`,
                    );
                }

                // 检查连续失败次数
                if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
                    console.log(
                        `\n已连续遇到 ${CONSECUTIVE_FAILURE_LIMIT} 次失败 (404 或错误)，停止尝试更多 ID。`,
                    );
                    break;
                }
            }
            // 清除行尾可能残留的字符
            // process.stdout.write("\r" + " ".repeat(process.stdout.columns) + "\r");

            // 添加随机延迟
            const delay =
                Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS) + DELAY_MIN_MS;
            await sleep(delay);
        }
        process.stdout.write("\n"); // 结束进度条输出，换行

        console.log(
            `\n新文章检查完成。本次运行共向 MeiliSearch 添加了 ${newArticlesCount} 篇新文章。`,
        );
        console.log("脚本执行完毕。");
    }

    // 判断脚本是否是直接被执行的
    // 在 ESM 中，可以通过 import.meta.url 和 process.argv[1] (转换后) 来判断
    // 一个更简单且常用的方法是直接调用主函数
    if (
        import.meta.url.startsWith("file://") &&
        process.argv[1] === new URL(import.meta.url).pathname
    ) {
        // 或者更简单地，直接运行主函数，因为我们打算通过 node dist/spider/... 来执行
        main();
    }
}

main();

// export { main };
