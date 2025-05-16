import { MeiliSearch } from "meilisearch";
import {
  ArticleDocument,
  ProcessArticleResultStatus,
  ProcessArticleResult,
} from "@/lib/types";

const MEILI_HOST = process.env.MEILI_HOST || "http://localhost:7700";
const MEILI_API_KEY = process.env.MEILI_API_KEY || ""; // 如果有 API 密钥，可以从环境变量加载
export const INDEX_NAME = "apollo_articles"; // 这应该与爬虫使用的索引名称一致

// MeiliSearch 搜索选项类型
interface SearchOptions {
  offset?: number;
  limit?: number;
  attributesToRetrieve?: string[];
  sort?: string[];
  filter?: string;
}

// 创建 MeiliSearch 客户端
const meiliClient = new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_API_KEY, // 如果有，取消注释
});

// MeiliSearch 错误类型 - 内部使用，无需导出
interface MeiliSearchError {
  message: string;
  code?: string;
}

/**
 * 获取或创建 MeiliSearch 索引并配置属性
 * @param indexName 索引名称
 */
export async function getOrCreateIndex(indexName: string) {
  try {
    const index = meiliClient.index<ArticleDocument>(indexName);
    // 尝试获取索引信息，如果存在则不会抛出 index_not_found
    await index.getRawInfo();
    console.log(`已连接到 MeiliSearch 索引：${indexName}`);

    // 确保配置属性（无论是否新建）
    await index.updateFilterableAttributes(["author", "views", "likes"]);
    await index.updateSortableAttributes(["id", "publishTimestamp"]);

    return index;
  } catch (error: unknown) {
    const err = error as MeiliSearchError;
    if (
      err.code === "index_not_found" ||
      (err.message && err.message.includes(`Index \`${indexName}\` not found`))
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
        const index = meiliClient.index<ArticleDocument>(indexName);
        console.log(`索引 ${indexName} 创建成功。`);

        // 配置新创建的索引
        await index.updateFilterableAttributes(["author", "views", "likes"]);
        await index.updateSortableAttributes(["id", "publishTimestamp"]);

        return index;
      } catch (creationError: unknown) {
        const creationErr = creationError as MeiliSearchError;
        console.error(
          `创建 MeiliSearch 索引 ${indexName} 时出错:`,
          creationErr.message,
        );
        throw creationError; // 抛出错误以便调用者处理
      }
    } else {
      console.error(
        `连接或处理 MeiliSearch 索引 ${indexName} 时遇到未预期错误:`,
        err.message,
      );
      throw error; // 抛出错误
    }
  }
}

export async function addDocumentsWithRetry(
  documents: ArticleDocument[], // 直接接收文档数组
  batchSize = 1000,
  retries = 3,
) {
  // 确保索引存在并获取 index 对象
  const index = await getOrCreateIndex(INDEX_NAME);

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    let attempt = 0;
    while (attempt < retries) {
      try {
        console.log(
          `Attempt ${attempt + 1}: Adding batch ${
            i / batchSize + 1
          } to index "${INDEX_NAME}"...`,
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
  console.log(`All documents added to index "${INDEX_NAME}".`);
}

/**
 * 获取文章索引 - 已废弃，请直接使用 getOrCreateIndex
 * @deprecated 使用 getOrCreateIndex 代替
 */
const getIndex = async () => {
  // 内部调用 getOrCreateIndex 确保配置
  return getOrCreateIndex(INDEX_NAME);
};

/**
 * 搜索文章
 * @param query 搜索关键词
 * @param page 页码（从 1 开始）
 * @param limit 每页结果数
 * @returns 搜索结果和总命中数
 */
export async function searchArticles(
  query: string,
  page: number = 1,
  limit: number = 10,
) {
  const index = await getIndex();
  const offset = (page - 1) * limit;

  // 构建搜索选项
  const searchOptions: SearchOptions = {
    offset,
    limit,
    attributesToRetrieve: [
      "id",
      "title",
      "content",
      "url",
      "publishTimestamp",
      "publishDateStr",
      "author",
      "views",
      "likes",
    ],
    sort: ["id:desc"],
  };

  try {
    // 执行搜索
    const searchResults = await index.search(query, searchOptions);

    return {
      hits: searchResults.hits as ArticleDocument[],
      totalHits: searchResults.estimatedTotalHits || 0,
    };
  } catch (error) {
    console.error("Meilisearch 搜索错误：", error);
    throw new Error("搜索时出错，请稍后再试");
  }
}

/**
 * 获取最新文章
 * @param limit 获取数量
 * @returns 最新文章列表
 */
export async function getLatestArticles(limit: number = 10) {
  return searchArticles("", 1, limit);
}

/**
 * 按 ID 获取单篇文章
 * @param id 文章 ID
 * @returns 文章对象或 null
 */
export async function getArticleById(id: number) {
  try {
    const index = await getIndex();
    const article = await index.getDocument(id.toString());
    return article as ArticleDocument;
  } catch (error) {
    console.error(`获取文章 ID ${id} 失败:`, error);
    return null;
  }
}
