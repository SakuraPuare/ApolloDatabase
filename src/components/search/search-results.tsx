"use client";

import Link from "next/link";
import { ArticleDocument } from "@/utils/shared_types";
import { Calendar, User, Eye, ThumbsUp } from "lucide-react";

interface SearchResultsProps {
  articles: ArticleDocument[];
  loading: boolean;
  query: string;
}

export default function SearchResults({
  articles,
  loading,
  query,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <ArticleSkeleton key={i} />
          ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-10">
        {query ? (
          <div>
            <h3 className="text-lg font-medium mb-2">未找到相关文章</h3>
            <p className="text-gray-500">尝试使用其他关键词搜索</p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-medium mb-2">请输入关键词开始搜索</h3>
            <p className="text-gray-500">探索百度 Apollo 官网的文章内容</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} query={query} />
      ))}
    </div>
  );
}

function ArticleCard({
  article,
  query,
}: {
  article: ArticleDocument;
  query: string;
}) {
  // 格式化时间
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr.replace(" ", "T") + "Z");
      return isNaN(date.getTime())
        ? dateStr
        : date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    } catch (e) {
      return dateStr;
    }
  };

  // 截取内容摘要
  const getContentSummary = (content: string | null) => {
    if (!content) return "无内容预览";

    // 移除 HTML 标签
    const textContent = content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 如果有搜索词，尝试提取包含搜索词的片段
    if (query) {
      const lowerQuery = query.toLowerCase();
      const lowerContent = textContent.toLowerCase();
      const index = lowerContent.indexOf(lowerQuery);

      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(textContent.length, index + query.length + 50);
        let excerpt = textContent.substring(start, end);

        if (start > 0) excerpt = "..." + excerpt;
        if (end < textContent.length) excerpt = excerpt + "...";

        return excerpt;
      }
    }

    // 默认返回前100个字符
    return textContent.length > 100
      ? textContent.substring(0, 100) + "..."
      : textContent;
  };

  return (
    <article className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <Link
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xl font-medium hover:text-blue-600 transition-colors"
      >
        {article.title}
      </Link>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500 mt-2 mb-3">
        {article.publishDateStr && (
          <div className="flex items-center">
            <Calendar size={16} className="mr-1" />
            <span>{formatDate(article.publishDateStr)}</span>
          </div>
        )}

        {article.author && (
          <div className="flex items-center">
            <User size={16} className="mr-1" />
            <span>{article.author}</span>
          </div>
        )}

        <div className="flex items-center">
          <Eye size={16} className="mr-1" />
          <span>{article.views} 次浏览</span>
        </div>

        <div className="flex items-center">
          <ThumbsUp size={16} className="mr-1" />
          <span>{article.likes} 次点赞</span>
        </div>
      </div>

      <p className="text-gray-600 mt-2">{getContentSummary(article.content)}</p>
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-5 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="flex gap-2 mb-3">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}
