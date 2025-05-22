import { getOrCreateIndex, IndexConfig } from "@/lib/meilisearch";
import { DocDocument, CrawledPageDocument } from "@/lib/types";
import {
  MeiliSearchApiError,
  ErrorStatusCode,
  SearchParams,
  SearchResponse,
} from "meilisearch";

// MeiliSearch 搜索选项类型
interface SearchOptions {
  offset?: number;
  limit?: number;
  attributesToRetrieve?: string[];
  sort?: string[];
  filter?: string;
}

// 文档索引配置
const DOC_INDEX_CONFIG: IndexConfig = {
  primaryKey: "id",
  filterableAttributes: ["id", "url", "title", "content", "crawledAt"],
  sortableAttributes: ["crawledAt"],
};

export const DOC_INDEX_NAME = "apollo_docs"; // 统一定义文档索引名称

/**
 * 获取文档索引
 */
async function getDocIndex<
  T extends DocDocument | CrawledPageDocument = DocDocument,
>() {
  return getOrCreateIndex<T>(DOC_INDEX_NAME, DOC_INDEX_CONFIG);
}

/**
 * 搜索文档
 * @param query 搜索关键词
 * @param page 页码（从 1 开始）
 * @param limit 每页结果数
 * @returns 搜索结果和总命中数
 */
export async function searchDocs(
  query: string,
  page: number = 1,
  limit: number = 10,
) {
  const index = await getDocIndex<DocDocument>();
  const offset = (page - 1) * limit;

  // 构建搜索选项
  const searchOptions: SearchOptions = {
    offset,
    limit,
    attributesToRetrieve: ["id", "title", "content", "url", "crawledAt"],
  };

  try {
    // 执行搜索
    const searchResults = await index.search(query, searchOptions);

    return {
      hits: searchResults.hits,
      totalHits: searchResults.estimatedTotalHits || 0,
    };
  } catch (error) {
    console.error("Meilisearch 搜索错误：", error);
    throw new Error("搜索文档时出错，请稍后再试");
  }
}

/**
 * 获取最新文档
 * @param limit 获取数量
 * @returns 最新文档列表
 */
export async function getLatestDocs(limit: number = 10) {
  return searchDocs("", 1, limit);
}

/**
 * 按 ID 获取单个文档
 * @param id 文档 ID
 * @returns 文档对象或 null
 */
export async function getDocById(id: string) {
  try {
    const index = await getDocIndex<DocDocument>();
    const doc = await index.getDocument(id);
    return doc;
  } catch (error: unknown) {
    if (
      error instanceof MeiliSearchApiError &&
      error.cause?.code === ErrorStatusCode.DOCUMENT_NOT_FOUND
    ) {
      console.warn(`获取文档 ID ${id} 未找到。`);
      return null;
    }
    // Log other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`获取文档 ID ${id} 失败：${errorMessage}`);
    if (error instanceof MeiliSearchApiError) {
      const cause = error.cause;
      const httpStatus = error.response?.status;
      console.error(
        `MeiliSearch Error Details: Code - ${cause?.code || "N/A"}, HTTPStatus - ${httpStatus || "N/A"}, Type - ${cause?.type || "N/A"}`,
      );
    }
    return null;
  }
}

/**
 * 根据 ID 获取单个爬取的页面文档
 * @param id - CrawledPageDocument 的 ID (URL 的 MD5 哈希值)
 * @returns 如果找到则返回 CrawledPageDocument，否则返回 null
 */
export async function getCrawledPageById(
  id: string,
): Promise<CrawledPageDocument | null> {
  try {
    const index = await getDocIndex<CrawledPageDocument>();
    const document = await index.getDocument(id);
    return document;
  } catch (error: unknown) {
    if (
      error instanceof MeiliSearchApiError &&
      error.cause?.code === ErrorStatusCode.DOCUMENT_NOT_FOUND
    ) {
      console.warn(`爬取页面 ID ${id} 未找到。`);
      return null;
    }
    // Log other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`获取爬取页面 ID ${id} 失败：${errorMessage}`);
    if (error instanceof MeiliSearchApiError) {
      const cause = error.cause;
      const httpStatus = error.response?.status;
      console.error(
        `MeiliSearch Error Details: Code - ${cause?.code || "N/A"}, HTTPStatus - ${httpStatus || "N/A"}, Type - ${cause?.type || "N/A"}`,
      );
    }
    return null;
  }
}

/**
 * 搜索爬取的页面文档
 * @param query - 搜索查询字符串
 * @param options - MeiliSearch 的搜索参数 (可选)
 * @returns 返回搜索结果对象
 */
export async function searchCrawledPages(
  query: string,
  options?: SearchParams,
): Promise<SearchResponse<CrawledPageDocument>> {
  try {
    const index = await getDocIndex<CrawledPageDocument>();
    const searchResults = await index.search(query, options);
    return searchResults;
  } catch (error) {
    console.error(`搜索爬取页面时出错，查询：'${query}'：`, error);
    throw error;
  }
}
