import { MeiliSearch, TaskStatus } from "meilisearch";
import axios from "axios"; // 建议使用 import
import { load as cheerioLoad } from "cheerio"; // 建议使用 import

// --- 定义 MeiliSearch 文档接口 ---
export interface ArticleDocument {
  id: number;
  url: string;
  title: string;
  content: string | null;
  publishTimestamp: number | null;
  publishDateStr: string;
  author: string;
  views: number;
  likes: number;
}

// --- 配置参数 ---
export const DELAY_MIN_MS = 1000; // 最小延迟 (毫秒)
export const DELAY_MAX_MS = 3000; // 最大延迟 (毫秒)
export const MEILI_HOST = "http://localhost:7700";
// export const MEILI_API_KEY = 'YourSecureMasterKey'; // 如果设置了 Master Key
export const INDEX_NAME = "articles"; // MeiliSearch 索引名称

// --- 配置 MeiliSearch 客户端 ---
export const meiliClient = new MeiliSearch({
  host: MEILI_HOST,
  // apiKey: MEILI_API_KEY,
});

// 函数：添加延迟
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 函数：获取或创建 MeiliSearch 索引
export async function getOrCreateIndex(indexName: string) {
  try {
    const index = await meiliClient.getIndex(indexName);
    console.log(`已连接到 MeiliSearch 索引：${indexName}`);
    return index;
  } catch (error: any) {
    if (
      error.code === "index_not_found" ||
      (error.message &&
        error.message.includes(`Index \`${indexName}\` not found`))
    ) {
      console.log(`索引 ${indexName} 不存在，正在创建...`);
      try {
        const taskResponse = await meiliClient.createIndex(indexName, {
          primaryKey: "id",
        });
        console.log(
          `创建索引任务已提交，Task UID: ${taskResponse.taskUid}. 等待创建完成...`,
        );
        await meiliClient.tasks.waitForTask(taskResponse.taskUid, {
          timeout: 60000,
          interval: 100,
        });
        const index = await meiliClient.getIndex(indexName);
        console.log(`索引 ${indexName} 创建成功。`);
        return index;
      } catch (creationError: any) {
        console.error(
          `创建 MeiliSearch 索引 ${indexName} 时出错:`,
          creationError.message,
        );
        throw creationError; // 抛出错误以便调用者处理
      }
    } else {
      console.error(
        `连接或处理 MeiliSearch 索引 ${indexName} 时遇到未预期错误:`,
        error.message,
      );
      throw error; // 抛出错误
    }
  }
}

export async function addDocumentsWithRetry(
  indexUid: string,
  documents: any[],
  batchSize = 1000,
  retries = 3,
) {
  const index = meiliClient.index(indexUid);
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    let attempt = 0;
    while (attempt < retries) {
      try {
        console.log(
          `Attempt ${attempt + 1}: Adding batch ${
            i / batchSize + 1
          } to index "${indexUid}"...`,
        );
        const taskResponse = await index.addDocuments(batch);
        console.log(
          `Task ${taskResponse.taskUid} created for batch ${
            i / batchSize + 1
          }. Waiting for completion...`,
        );
        await meiliClient.tasks.waitForTask(taskResponse.taskUid, {
          timeout: 60000,
          interval: 100,
        });
        console.log(`Batch ${i / batchSize + 1} added successfully.`);
        break; // Success, exit retry loop
      } catch (error) {
        attempt++;
        console.error(
          `Error adding batch ${i / batchSize + 1} (Attempt ${attempt}):`,
          error,
        );
        if (attempt >= retries) {
          console.error(
            `Failed to add batch ${
              i / batchSize + 1
            } after ${retries} attempts.`,
          );
          // Optionally re-throw the error or handle it differently
          throw error;
        }
        // Wait before retrying (e.g., exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)),
        );
      }
    }
  }
  console.log(`All documents added to index "${indexUid}".`);
}

// 函数：获取文章详情并解析
export async function fetchAndParseArticle(
  articleId: number,
): Promise<{ status: number; data?: Partial<ArticleDocument> } | null> {
  const articleUrl = `https://apollo.baidu.com/community/article/${articleId}`;
  try {
    const response = await axios.get(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

    if (response.status === 404) {
      return { status: 404 };
    }

    if (response.status >= 400) {
      console.warn(`ID ${articleId} 返回错误状态码：${response.status}`);
      return { status: response.status };
    }

    const html = response.data;
    const $ = cheerioLoad(html);

    const title = $("h1").text().trim();
    if (!title) {
      // 页面可能实际是 404 但返回 200，或者无内容
      console.warn(`ID ${articleId} 获取到空标题或无效内容，视为 404。`);
      return { status: 404 }; // 将其视为 404
    }

    const content = $(".style_article__content__richtext__1R31p").html();
    const publishDateStr = $(
      ".style_article__content__follow__1TzQY span.style_marginright24__1REsu",
    )
      .text()
      .trim();
    const author = $(".style_author__name__3Rpg1").text().trim();
    const statsSpans = $(".style_article__content__follow__1TzQY span");
    const viewsText = statsSpans.eq(1).text().trim();
    const likesText = statsSpans.eq(2).find("span").last().text().trim();
    const views = viewsText ? parseInt(viewsText.replace(/\D/g, ""), 10) : 0;
    const likes = likesText ? parseInt(likesText, 10) : 0;

    // 尝试更健壮的日期解析
    let publishDate: Date | null = null;
    let publishTimestamp: number | null = null;
    if (publishDateStr) {
      try {
        // 假设格式为 "YYYY-MM-DD HH:mm:ss" 或类似，需要转换为 ISO 8601
        // 尝试添加 'T' 和 'Z' (UTC) 如果格式允许
        const isoStr = publishDateStr.includes(" ")
          ? publishDateStr.replace(" ", "T") + "Z"
          : publishDateStr;
        publishDate = new Date(isoStr);
        if (!isNaN(publishDate.getTime())) {
          publishTimestamp = Math.floor(publishDate.getTime() / 1000);
        } else {
          console.warn(
            `ID ${articleId} 无法将 "${publishDateStr}" 解析为有效日期。`,
          );
          publishDate = null; // 重置为 null
        }
      } catch (e) {
        console.warn(`ID ${articleId} 解析日期 "${publishDateStr}" 时出错:`, e);
        publishDate = null;
      }
    }

    return {
      status: 200,
      data: {
        id: articleId,
        url: articleUrl,
        title: title,
        content: content,
        publishTimestamp: publishTimestamp,
        publishDateStr: publishDateStr,
        author: author,
        views: views,
        likes: likes,
      },
    };
  } catch (error: any) {
    console.error(
      `处理文章 ID ${articleId} 时发生网络或解析错误:`,
      error.message,
    );
    // 根据错误类型决定返回状态，或者直接返回 null 表示严重错误
    if (axios.isAxiosError(error) && error.response) {
      return { status: error.response.status }; // 返回 HTTP 状态码
    }
    return null; // 其他网络错误或解析错误
  }
}
