"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

interface SearchFormProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  disabled?: boolean;
}

export default function SearchForm({
  initialQuery,
  onSearch,
  disabled = false,
}: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="输入关键词搜索 Apollo 文章..."
          disabled={disabled}
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        搜索
      </button>
    </form>
  );
}
