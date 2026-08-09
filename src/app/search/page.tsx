"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchArticles, preloadIndex } from "@/lib/search";
import type { ArticleDocument } from "@/lib/types";
import HighlightText from "@/components/search/highlight-text";
import Pagination from "@/components/search/pagination";
import SearchSkeleton from "@/components/search/search-skeleton";
import Link from "next/link";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 10;

  const [results, setResults] = useState<ArticleDocument[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [indexReady, setIndexReady] = useState(false);
  const [inputValue, setInputValue] = useState(query);

  useEffect(() => {
    preloadIndex().then(() => setIndexReady(true));
  }, []);

  useEffect(() => {
    if (!indexReady) return;

    setLoading(true);
    searchArticles(query, page, limit).then(({ hits, totalHits }) => {
      setResults(hits);
      setTotalHits(totalHits);
      setLoading(false);
    });
  }, [query, page, indexReady]);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (inputValue) params.set("q", inputValue);
      params.set("page", "1");
      router.push(`/search?${params.toString()}`);
    },
    [inputValue, router]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("page", String(newPage));
      router.push(`/search?${params.toString()}`);
    },
    [query, router]
  );

  const totalPages = Math.ceil(totalHits / limit);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Apollo 搜索</h1>

      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2 mb-8"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="输入关键词搜索文章..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!indexReady}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {indexReady ? "搜索" : "加载中..."}
        </button>
      </form>

      <div className="min-h-[60vh]">
        {loading ? (
          <SearchSkeleton />
        ) : (
          <>
            {query && (
              <p className="mb-4 text-gray-600">
                找到约 {totalHits} 个结果 (搜索词：{query})
              </p>
            )}

            {results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-600">未找到匹配的文章</p>
              </div>
            ) : (
              <div className="space-y-6">
                {results.map((article) => (
                  <article
                    key={article.id}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  >
                    <Link
                      href={`https://apollo.baidu.com/community/article/${article.id}`}
                      target="_blank"
                    >
                      <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600">
                        <HighlightText text={article.title} query={query} />
                      </h2>
                    </Link>

                    <div className="flex flex-wrap text-sm text-gray-500 mb-3 gap-4">
                      <span>{article.author || "佚名"}</span>
                      <span>{article.publishDateStr}</span>
                      <span>查看：{article.views}</span>
                      <span>点赞：{article.likes}</span>
                    </div>

                    <p className="text-gray-700">
                      <HighlightText
                        text={article.content || "暂无内容"}
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
            )}

            {totalHits > 0 && totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}
