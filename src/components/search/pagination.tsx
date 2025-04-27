"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // 最多显示多少个页码按钮
  const maxVisibleButtons = 5;

  // 计算应显示哪些页码
  const getVisiblePages = () => {
    // 如果总页数小于最大可显示数量，直接显示所有页码
    if (totalPages <= maxVisibleButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // 计算左右应该显示多少页码
    const halfVisible = Math.floor(maxVisibleButtons / 2);

    // 开始页码
    let startPage = Math.max(currentPage - halfVisible, 1);
    // 结束页码
    let endPage = startPage + maxVisibleButtons - 1;

    // 如果结束页码超出总页数，调整开始和结束页码
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(endPage - maxVisibleButtons + 1, 1);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i,
    );
  };

  const visiblePages = getVisiblePages();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center mt-8">
      <nav className="flex items-center gap-1" aria-label="分页导航">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>

        {visiblePages[0] > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className={`px-3 py-1 rounded-md hover:bg-gray-100 ${
                currentPage === 1 ? "bg-blue-100 text-blue-600 font-medium" : ""
              }`}
            >
              1
            </button>
            {visiblePages[0] > 2 && (
              <span className="px-1 text-gray-500">...</span>
            )}
          </>
        )}

        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 rounded-md hover:bg-gray-100 ${
              currentPage === page
                ? "bg-blue-100 text-blue-600 font-medium"
                : ""
            }`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        ))}

        {visiblePages[visiblePages.length - 1] < totalPages && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-gray-500">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className={`px-3 py-1 rounded-md hover:bg-gray-100 ${
                currentPage === totalPages
                  ? "bg-blue-100 text-blue-600 font-medium"
                  : ""
              }`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}
