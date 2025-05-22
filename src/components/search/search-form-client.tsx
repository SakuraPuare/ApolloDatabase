"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { SearchType } from "@/lib/types";

interface SearchFormClientProps {
  initialQuery?: string;
  searchType: SearchType;
}

export default function SearchFormClient({
  initialQuery = "",
  searchType = SearchType.Article,
}: SearchFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 构建新的URL搜索参数
    const params = new URLSearchParams(searchParams.toString());

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }

    // 保留搜索类型
    params.set("type", searchType);

    // 重置页码
    params.set("page", "1");

    // 使用router.push进行客户端导航
    router.push(`/search?${params.toString()}`);

    // 短暂的防抖，避免频繁提交
    setTimeout(() => {
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          searchType === SearchType.Article
            ? "输入关键词搜索文章..."
            : "输入关键词搜索文档..."
        }
        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className={`px-6 py-2 bg-blue-600 text-white rounded-md ${
          isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"
        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        {isSubmitting ? "搜索中..." : "搜索"}
      </button>
    </form>
  );
}
