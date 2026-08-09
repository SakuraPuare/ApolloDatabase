"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchArticles, preloadIndex } from "@/lib/search";
import type { ArticleDocument } from "@/lib/types";
import HighlightText from "@/components/search/highlight-text";
import Link from "next/link";
import { Search, Sun, Moon, Clock, TrendingUp, Flame, X } from "lucide-react";
import { SiGithub } from "react-icons/si";

type SortMode = "relevance" | "time" | "views";

function SearchApp() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") || "";
  const sortParam = (searchParams.get("sort") as SortMode) || "relevance";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 20;

  const [results, setResults] = useState<ArticleDocument[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const [inputValue, setInputValue] = useState(query);
  const [sortMode, setSortMode] = useState<SortMode>(sortParam);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [dark, setDark] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load theme
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Load search history
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("search-history") || "[]");
      setSearchHistory(h);
    } catch {}
  }, []);

  // Preload index with progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setIndexProgress((p) => Math.min(p + Math.random() * 15, 90));
    }, 200);

    preloadIndex().then(() => {
      clearInterval(interval);
      setIndexProgress(100);
      setTimeout(() => setIndexReady(true), 300);
    });

    return () => clearInterval(interval);
  }, []);

  // Search execution
  useEffect(() => {
    if (!indexReady) return;
    setLoading(true);

    searchArticles(query, 1, 10000, sortMode).then(({ hits, totalHits }) => {
      const offset = (page - 1) * limit;
      setResults(hits.slice(offset, offset + limit));
      setTotalHits(totalHits);
      setLoading(false);
    });
  }, [query, page, sortMode, indexReady]);

  // Sync input with URL
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setShowHistory(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const navigate = useCallback(
    (q: string, sort: SortMode, p: number = 1) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (sort !== "relevance") params.set("sort", sort);
      if (p > 1) params.set("page", String(p));
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : "/");
    },
    [router]
  );

  const handleInput = useCallback(
    (value: string) => {
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        navigate(value, sortMode);
      }, 300);
    },
    [navigate, sortMode]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      navigate(inputValue, sortMode);
      if (inputValue.trim()) {
        const newHistory = [
          inputValue,
          ...searchHistory.filter((h) => h !== inputValue),
        ].slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem("search-history", JSON.stringify(newHistory));
      }
      setShowHistory(false);
    },
    [inputValue, sortMode, navigate, searchHistory]
  );

  const handleSortChange = useCallback(
    (sort: SortMode) => {
      setSortMode(sort);
      navigate(query, sort);
    },
    [query, navigate]
  );

  const toggleDark = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [dark]);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem("search-history");
  }, []);

  const totalPages = Math.ceil(totalHits / limit);
  const hasQuery = query.trim().length > 0;

  // Loading screen
  if (!indexReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Apollo 数据库
          </h1>
          <p className="text-muted-foreground">正在加载搜索索引...</p>
        </div>
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${indexProgress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round(indexProgress)}%
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Apollo 数据库
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="切换主题"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              href="https://github.com/SakuraPuare/ApolloDatabase"
              target="_blank"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <SiGithub size={18} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Hero (only when no query) */}
        {!hasQuery && !loading && (
          <div className="text-center mb-8 pt-8">
            <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              搜索 Apollo 文档
            </h2>
            <p className="text-muted-foreground text-lg">
              521 篇文章 · 浏览器端即时搜索 · 按{" "}
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">
                /
              </kbd>{" "}
              聚焦
            </p>
          </div>
        )}

        {/* Search Box */}
        <div className="relative mb-6">
          <form onSubmit={handleSubmit} className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder="搜索文章标题、内容、作者..."
              className="w-full pl-11 pr-4 py-3 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-base placeholder:text-muted-foreground"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue("");
                  navigate("", sortMode);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Search History Dropdown */}
          {showHistory && searchHistory.length > 0 && !inputValue && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">搜索历史</span>
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  清除
                </button>
              </div>
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  onMouseDown={() => {
                    setInputValue(h);
                    navigate(h, sortMode);
                  }}
                >
                  <Clock size={14} className="text-muted-foreground" />
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Bar */}
        {hasQuery && totalHits > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              找到 {totalHits} 个结果
            </p>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              {[
                { key: "relevance" as SortMode, icon: TrendingUp, label: "最新" },
                { key: "views" as SortMode, icon: Flame, label: "热门" },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => handleSortChange(key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    sortMode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-3">
          {loading ? (
            <LoadingSkeleton />
          ) : results.length === 0 && hasQuery ? (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">
                未找到「{query}」的相关结果
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                试试换个关键词？
              </p>
            </div>
          ) : results.length === 0 && !hasQuery ? (
            <RecentArticles
              onSearch={(q) => {
                setInputValue(q);
                navigate(q, sortMode);
              }}
            />
          ) : (
            results.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                query={query}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => navigate(query, sortMode, page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-muted-foreground px-3">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => navigate(query, sortMode, page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <p className="text-center text-xs text-muted-foreground">
          Apollo 数据库 · Orama 全文搜索 · Cloudflare Pages
        </p>
      </footer>
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
  return (
    <a
      href={`https://apollo.baidu.com/community/article/${article.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-border/80 transition-all group"
    >
      <h3 className="font-semibold text-card-foreground group-hover:text-blue-500 transition-colors mb-1.5">
        <HighlightText text={article.title} query={query} />
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
        <HighlightText
          text={article.content || ""}
          query={query}
          maxLength={200}
        />
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{article.author || "佚名"}</span>
        {article.publishDateStr && <span>{article.publishDateStr}</span>}
        {article.views > 0 && <span>{article.views} 阅读</span>}
        {article.likes > 0 && <span>{article.likes} 赞</span>}
      </div>
    </a>
  );
}

function RecentArticles({ onSearch }: { onSearch: (q: string) => void }) {
  const suggestions = ["自动驾驶", "感知", "规划", "仿真", "Apollo"];
  return (
    <div className="text-center py-8">
      <p className="text-sm text-muted-foreground mb-4">热门搜索</p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSearch(s)}
            className="px-4 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border animate-pulse"
          >
            <div className="h-5 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-2/3 mb-3" />
            <div className="flex gap-3">
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-3 bg-muted rounded w-14" />
            </div>
          </div>
        ))}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <SearchApp />
    </Suspense>
  );
}
