import axios from "axios";
import { load as cheerioLoad } from "cheerio";

// 从共享类型文件导入 ArticleDocument, ProcessArticleResultStatus, ProcessArticleResult
import {
  ArticleDocument,
  ProcessArticleResultStatus,
  ProcessArticleResult,
} from "@/lib/types";

// --- 配置参数 (非 MeiliSearch 相关) ---
export const DELAY_MIN_MS = 1000; // 最小延迟 (毫秒)
export const DELAY_MAX_MS = 3000; // 最大延迟 (毫秒)

// 函数：添加延迟
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  } catch (error: unknown) {
    const err = error as Error & { response?: { status: number } };
    console.error(
      `处理文章 ID ${articleId} 时发生网络或解析错误:`,
      err.message,
    );
    // 根据错误类型决定返回状态，或者直接返回 null 表示严重错误
    if (axios.isAxiosError(error) && err.response) {
      return { status: err.response.status }; // 返回 HTTP 状态码
    }
    return null; // 其他网络错误或解析错误
  }
}

/**
 * Fetches and parses a single article by ID, handling retries and status checks.
 * @param id The article ID to process.
 * @returns A ProcessArticleResult indicating the outcome and optionally the ArticleDocument.
 */
export async function processArticleId(
  id: number,
): Promise<ProcessArticleResult> {
  const maxRetries = 3; // 定义最大重试次数
  const articleUrl = `https://apollo.baidu.com/community/article/${id}`; // 避免重复构建 URL

  async function tryFetch(retryCount = 0): Promise<ProcessArticleResult> {
    try {
      // 移除详细的内部日志，将日志输出移到调用方
      const result = await fetchAndParseArticle(id);

      if (result && result.status === 200 && result.data) {
        // 成功
        const article: ArticleDocument = {
          id: result.data.id!,
          url: result.data.url || articleUrl, // 使用上面定义的 articleUrl
          title: result.data.title || "无标题",
          content: result.data.content || null,
          publishTimestamp: result.data.publishTimestamp || null,
          publishDateStr: result.data.publishDateStr || "",
          author: result.data.author || "未知作者",
          views: result.data.views || 0,
          likes: result.data.likes || 0,
        };
        return { status: ProcessArticleResultStatus.Success, article };
      } else if (
        (result && result.status === 500) ||
        (result && result.status === 404)
      ) {
        // 404 或 500 表示文章未找到
        return { status: ProcessArticleResultStatus.NotFound };
      } else {
        // 其他 HTTP 错误
        return { status: ProcessArticleResultStatus.OtherHttpError };
      }
    } catch {
      // 网络或解析错误 (fetchAndParseArticle 内部抛出的异常)
      if (retryCount < maxRetries) {
        // 重试
        await sleep(1000 * (retryCount + 1)); // 递增重试延迟
        return tryFetch(retryCount + 1);
      } else {
        // 达到最大重试次数
        return { status: ProcessArticleResultStatus.FetchError };
      }
    }
  }

  return tryFetch();
}
