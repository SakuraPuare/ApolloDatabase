import { getOrCreateIndex, IndexConfig } from "@/lib/meilisearch";
import { ArticleDocument } from "@/lib/types";
import { MeiliSearchApiError, ErrorStatusCode } from "meilisearch";

// MeiliSearch 搜索选项类型
interface SearchOptions {
  offset?: number;
  limit?: number;
  attributesToRetrieve?: string[];
  sort?: string[];
  filter?: string;
}

// 文章索引配置
const ARTICLE_INDEX_CONFIG: IndexConfig = {
  primaryKey: "id",
  filterableAttributes: [
    "author",
    "views",
    "likes",
    "status",
    "crawledAt",
    "publishTimestamp",
    "id",
    "url",
    "title",
  ],
  sortableAttributes: ["publishTimestamp", "views", "likes", "crawledAt"],
};

export const ARTICLE_INDEX_NAME = "apollo_articles"; // 统一定义文章索引名称

/**
 * 获取文章索引
 * @returns 文章索引实例
 */
async function getArticleIndex() {
  return getOrCreateIndex<ArticleDocument>(
    ARTICLE_INDEX_NAME,
    ARTICLE_INDEX_CONFIG,
  );
}

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
  const index = await getArticleIndex();
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
    sort: ["publishTimestamp:desc"],
  };

  try {
    // 执行搜索
    const searchResults = await index.search(query, searchOptions);
    // console.log("Query in searchArticles:", query);
    // console.log("Search results in searchArticles:", searchResults);

    return {
      hits: searchResults.hits,
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
export async function getArticleById(id: number | string) {
  try {
    const index = await getArticleIndex();
    // MeiliSearch getDocument expects a string ID
    const article = await index.getDocument(String(id));
    return article;
  } catch (error: unknown) {
    if (
      error instanceof MeiliSearchApiError &&
      error.cause?.code === ErrorStatusCode.DOCUMENT_NOT_FOUND
    ) {
      console.warn(`获取文章 ID ${id} 未找到。`);
      return null;
    }
    // Log other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`获取文章 ID ${id} 失败：${errorMessage}`);
    if (error instanceof MeiliSearchApiError) {
      const cause = error.cause;
      const httpStatus = error.response?.status;
      console.error(
        `MeiliSearch Error Details: Code - ${cause?.code || "N/A"}, HTTPStatus - ${httpStatus || "N/A"}, Type - ${cause?.type || "N/A"}`,
      );
    }
    return null; // Or rethrow, depending on desired error handling
  }
}
