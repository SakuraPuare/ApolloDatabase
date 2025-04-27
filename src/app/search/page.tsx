import { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { searchArticles } from "@/lib/meilisearch";
import SearchFormClient from "@/components/search/search-form-client";
import HighlightText from "@/components/search/highlight-text";
import { ArticleDocument } from "@/utils/shared_types";

export const metadata: Metadata = {
  title: "Apollo 搜索 | 查找百度 Apollo 官网文章",
  description: "搜索并发现百度 Apollo 官网的文章内容，按时间倒序展示",
};

// 为服务器端分页生成的分页组件
function ServerPagination({ 
  currentPage, 
  totalPages, 
  query 
}: { 
  currentPage: number; 
  totalPages: number; 
  query: string;
}) {
  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return (
    <div className="flex justify-center mt-6">
      <div className="flex space-x-1">
        {currentPage > 1 && (
          <Link
            href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
          >
            上一页
          </Link>
        )}
        
        {pages.map((page) => (
          <Link
            key={page}
            href={`/search?q=${encodeURIComponent(query)}&page=${page}`}
            className={`px-4 py-2 ${
              page === currentPage
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            } border border-gray-300 rounded-md`}
          >
            {page}
          </Link>
        ))}
        
        {currentPage < totalPages && (
          <Link
            href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
          >
            下一页
          </Link>
        )}
      </div>
    </div>
  );
}

// 文章列表组件
function ArticleList({ articles, query }: { articles: ArticleDocument[], query: string }) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600">未找到匹配的文章</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {articles.map((article) => (
        <article 
          key={article.id} 
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <Link href={`https://apollo.baidu.com/community/article/${article.id}`}>
            <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600">
              <HighlightText 
                text={article.title} 
                query={query} 
              />
            </h2>
          </Link>
          
          <div className="flex flex-wrap text-sm text-gray-500 mb-3 gap-4">
            <span>{article.author || '佚名'}</span>
            <span>{article.publishDateStr}</span>
            <span>查看：{article.views}</span>
            <span>点赞：{article.likes}</span>
          </div>
          
          <p className="text-gray-700">
            <HighlightText 
              text={article.content || '暂无内容'} 
              query={query}
              maxLength={300}
            />
          </p>
          
          <div className="mt-4">
            <Link 
              href={`https://apollo.baidu.com/community/article/${article.id}`} 
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              target="_blank"
            >
              阅读全文 →
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

// 搜索加载状态展示组件
function SearchFallback() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 animate-pulse">
          <div className="h-7 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="flex gap-4 mb-4">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 搜索结果容器
async function SearchResults({ 
  query, 
  page, 
  limit 
}: { 
  query: string; 
  page: number; 
  limit: number;
}) {
  // 在服务器端执行搜索
  const { hits, totalHits } = await searchArticles(query, page, limit);
  console.log(hits);
  const totalPages = Math.ceil(totalHits / limit);
  
  return (
    <>
      {/* 搜索结果统计 */}
      {query && (
        <p className="mb-4 text-gray-600">
          找到约 {totalHits} 个结果 (搜索词：{query})
        </p>
      )}
      
      {/* 文章列表 */}
      <ArticleList articles={hits} query={query} />
      
      {/* 分页 */}
      {totalHits > 0 && (
        <ServerPagination
          currentPage={page}
          totalPages={totalPages}
          query={query}
        />
      )}
    </>
  );
}

// 服务器端搜索页面
export default async function SearchPage(
  props: {
    searchParams: Promise<{ q?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const query = searchParams.q || "";
  const page = parseInt(searchParams.page || "1", 10);
  const limit = 10;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Apollo 文章搜索</h1>
      
      {/* 两种搜索表单实现：客户端增强版和服务器端回退版 */}
      <div className="mb-8">
        {/* 客户端表单，提供更好的用户体验 */}
        <SearchFormClient initialQuery={query} />
        
        {/* 服务器端回退表单（不显示，但作为渐进增强的保障） */}
        <noscript>
          <form 
            action={`/search`} 
            method="get" 
            className="flex flex-col sm:flex-row gap-2 mt-4"
          >
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="输入关键词搜索文章..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              搜索
            </button>
          </form>
        </noscript>
      </div>
      
      {/* 搜索结果区域 */}
      <div className="min-h-[60vh]">
        <Suspense fallback={<SearchFallback />}>
          <SearchResults query={query} page={page} limit={limit} />
        </Suspense>
      </div>
    </div>
  );
}