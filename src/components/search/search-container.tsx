"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArticleDocument } from "@/lib/types";
import SearchForm from "./search-form";
import SearchResults from "./search-results";
import Pagination from "./pagination";
import { searchArticles } from "@/services/article";

export interface SearchState {
  query: string;
  articles: ArticleDocument[];
  totalHits: number;
  page: number;
  loading: boolean;
  error: string | null;
}

export default function SearchContainer({
  initialQuery = "",
  initialPage = 1,
}: {
  initialQuery?: string;
  initialPage?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<SearchState>({
    query: initialQuery,
    articles: [],
    totalHits: 0,
    page: initialPage,
    loading: false,
    error: null,
  });

  const resultsPerPage = 10;

  const handleSearch = useCallback(
    async (query: string, page: number) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { hits, totalHits } = await searchArticles(
          query,
          page,
          resultsPerPage,
        );
        setState({
          query,
          articles: hits,
          totalHits,
          page,
          loading: false,
          error: null,
        });

        // 更新 URL，但不触发导航
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
          params.set("q", query);
        } else {
          params.delete("q");
        }
        params.set("page", page.toString());

        router.push(`/search?${params.toString()}`, { scroll: false });
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "搜索时发生错误，请稍后再试",
        }));
      }
    },
    [router, searchParams],
  );

  // 首次加载时执行搜索
  useEffect(() => {
    if (initialQuery || initialPage > 1) {
      handleSearch(initialQuery, initialPage);
    }
  }, [initialQuery, initialPage, handleSearch]);

  const handleSearchSubmit = (query: string) => {
    handleSearch(query, 1); // 新搜索始终从第一页开始
  };

  const handlePageChange = (page: number) => {
    handleSearch(state.query, page);
  };

  return (
    <div className="space-y-6">
      <SearchForm
        initialQuery={state.query}
        onSearch={handleSearchSubmit}
        disabled={state.loading}
      />

      {state.error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-md">
          {state.error}
        </div>
      )}

      <div className="min-h-[50vh]">
        <SearchResults
          articles={state.articles}
          loading={state.loading}
          query={state.query}
        />
      </div>

      {state.totalHits > 0 && (
        <Pagination
          currentPage={state.page}
          totalPages={Math.ceil(state.totalHits / resultsPerPage)}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
