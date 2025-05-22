"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SearchType } from "@/lib/types";

interface SearchTypeTabsProps {
  activeType: SearchType;
}

export default function SearchTypeTabs({ activeType }: SearchTypeTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTypeChange = useCallback(
    (type: SearchType) => {
      if (type === activeType) return;

      // 保留当前的查询参数
      const params = new URLSearchParams(searchParams.toString());

      // 设置新的类型
      params.set("type", type);

      // 重置页码
      params.set("page", "1");

      // 导航到新的URL
      router.push(`/search?${params.toString()}`);
    },
    [activeType, router, searchParams],
  );

  return (
    <div className="flex border-b border-gray-200 mb-6">
      <button
        onClick={() => handleTypeChange(SearchType.Article)}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeType === SearchType.Article
            ? "border-b-2 border-blue-500 text-blue-600"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        文章搜索
      </button>

      <button
        onClick={() => handleTypeChange(SearchType.Doc)}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeType === SearchType.Doc
            ? "border-b-2 border-blue-500 text-blue-600"
            : "text-gray-500 hover:text-gray-800"
        }`}
      >
        文档搜索
      </button>
    </div>
  );
}
