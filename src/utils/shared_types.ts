// 文章文档接口定义
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

// 处理单个文章 ID 的结果接口
export interface ProcessArticleResult {
  status: ProcessArticleResultStatus;
  article?: ArticleDocument | null; // 仅在 Success 状态下包含文章数据
}

// 新增/更新的文章处理结果状态枚举
export enum ProcessArticleResultStatus {
  Success, // 成功抓取并解析文章数据
  NotFound, // 文章不存在 (HTTP 404 或 500, 或解析后发现内容无效)
  FetchError, // 网络错误或解析错误 (重试后仍失败)
  OtherHttpError, // 其他非 404/500 的 HTTP 错误
} 