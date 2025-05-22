import {
  Index as MeiliIndex,
  SearchParams,
  SearchResponse,
  ErrorStatusCode,
  MeiliSearchApiError,
} from "meilisearch";
import { CrawledPageDocument } from "@/lib/types";
import { getOrCreateIndex } from "@/lib/meilisearch"; // 导入 getOrCreateIndex

// 和爬虫脚本中定义的索引名称保持一致
const DOCS_INDEX_NAME = "apollo_docs";

/**
 * 获取专门用于 CrawledPageDocument 的 MeiliSearch 索引实例
 */
async function getCrawledPagesIndex(): Promise<
  MeiliIndex<CrawledPageDocument>
> {
  return getOrCreateIndex<CrawledPageDocument>(DOCS_INDEX_NAME);
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
    const index = await getCrawledPagesIndex();
    const document = await index.getDocument(id);
    return document;
  } catch (error: unknown) {
    if (
      error instanceof MeiliSearchApiError &&
      error.cause?.code === ErrorStatusCode.DOCUMENT_NOT_FOUND
    ) {
      console.warn(`Crawled page with ID '${id}' not found in MeiliSearch.`);
      return null;
    }
    // Log other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Error fetching crawled page by ID '${id}' from MeiliSearch: ${errorMessage}`,
    );
    if (error instanceof MeiliSearchApiError) {
      const cause = error.cause;
      const httpStatus = error.response?.status;
      console.error(
        `MeiliSearch Error Details: Code - ${cause?.code || "N/A"}, HTTPStatus - ${httpStatus || "N/A"}, Type - ${cause?.type || "N/A"}`,
      );
    }
    throw error; // Re-throw other types of errors, or handle as appropriate
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
    const index = await getCrawledPagesIndex();
    const searchResults = await index.search(query, options);
    return searchResults;
  } catch (error) {
    console.error(
      `Error searching crawled pages with query '${query}' in MeiliSearch:`,
      error,
    );
    throw error; // 重新抛出错误
  }
}

/**
 * 可选：添加更多服务函数，例如：
 * - addCrawledPages (如果需要在爬虫之外添加文档)
 * - updateCrawledPage (如果需要更新现有文档)
 * - deleteCrawledPage (如果需要删除文档)
 */
