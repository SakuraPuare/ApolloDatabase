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
  [key: string]: unknown; // 添加索引签名
}

// --- 文档文档接口定义 ---
export interface DocDocument {
  id: string;
  url: string;
  title: string;
  content: string | null;
  path: string; // 文档路径
  category: string; // 文档分类
  updateTimestamp: number | null;
  updateDateStr: string;
  crawledAt: string;
  [key: string]: unknown; // 添加索引签名
}

// 搜索类型枚举
export enum SearchType {
  Article = "article",
  Doc = "doc",
}

// 新增/更新的文章处理结果状态枚举
export enum ProcessArticleResultStatus {
  Success, // 成功抓取并解析文章数据
  NotFound, // 文章不存在 (HTTP 404 或 500, 或解析后发现内容无效)
  FetchError, // 网络错误或解析错误 (重试后仍失败)
  OtherHttpError, // 其他非 404/500 的 HTTP 错误
}

// 处理单个文章 ID 的结果接口
export interface ProcessArticleResult {
  status: ProcessArticleResultStatus;
  article?: ArticleDocument | null; // 仅在 Success 状态下包含文章数据
}

// --- 定义爬取页面的 MeiliSearch 文档接口 ---
export interface CrawledPageDocument {
  id: string; // URL 的 MD5 哈希值
  url: string;
  title: string;
  content: string; // 页面原始内容 (HTML)
  crawledAt: string; // ISO 格式的爬取时间字符串
  [key: string]: unknown; // 添加索引签名
}
