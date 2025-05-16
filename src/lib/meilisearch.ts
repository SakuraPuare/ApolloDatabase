import { MeiliSearch } from "meilisearch";
import { ArticleDocument } from "@/utils/shared_types";

// MeiliSearch 配置
const MEILI_HOST = process.env.MEILI_HOST || "http://localhost:7700";
const MEILI_API_KEY = process.env.MEILI_API_KEY || ""; // 如果有 API 密钥，可以从环境变量加载
const INDEX_NAME = "apollo_articles"; // 这应该与爬虫使用的索引名称一致

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

// 获取文章索引
const getIndex = async () => {
  const index = meiliClient.index<ArticleDocument>(INDEX_NAME);
  await index.updateFilterableAttributes(["author", "views", "likes"]);
  await index.updateSortableAttributes(["id", "publishTimestamp"]);
  return index;
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
