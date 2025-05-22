import { Metadata } from "next";
import { Suspense } from "react";
import SearchFormClient from "@/components/search/search-form-client";
import SearchTypeTabs from "@/components/search/search-type-tabs";
import SearchSkeleton from "@/components/search/search-skeleton";
import ArticleSearchResults from "@/components/search/article-search-results";
import DocSearchResults from "@/components/search/doc-search-results";
import { SearchType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Apollo 搜索 | 查找百度 Apollo 官网内容",
  description: "搜索并发现百度 Apollo 官网的文章和文档内容",
};

// 服务器端搜索页面
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; type?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;

  // 确定搜索类型，默认为文章搜索
  const typeParam = params.type || "";
  const searchType: SearchType =
    typeParam === SearchType.Doc ? SearchType.Doc : SearchType.Article;

  // 根据搜索类型设置标题
  const searchTypeTitle = searchType === SearchType.Article ? "文章" : "文档";

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Apollo 搜索</h1>

      {/* 搜索类型切换标签 */}
      <div className="mb-6">
        <SearchTypeTabs activeType={searchType} />
      </div>

      {/* 搜索表单 */}
      <div className="mb-8">
        {/* 客户端表单，提供更好的用户体验 */}
        <SearchFormClient initialQuery={query} searchType={searchType} />

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
              placeholder={`输入关键词搜索${searchTypeTitle}...`}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input type="hidden" name="type" value={searchType} />
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
        <Suspense fallback={<SearchSkeleton />}>
          {searchType === SearchType.Article ? (
            <ArticleSearchResults query={query} page={page} limit={limit} />
          ) : (
            <DocSearchResults query={query} page={page} limit={limit} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
