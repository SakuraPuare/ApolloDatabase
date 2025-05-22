import { searchDocs } from "@/services/doc";
import DocList from "./doc-list";
import Pagination from "./pagination";

interface DocSearchResultsProps {
  query: string;
  page: number;
  limit: number;
}

export default async function DocSearchResults({
  query,
  page,
  limit,
}: DocSearchResultsProps) {
  // 在服务器端执行搜索
  const { hits, totalHits } = await searchDocs(query, page, limit);
  const totalPages = Math.ceil(totalHits / limit);

  return (
    <>
      {/* 搜索结果统计 */}
      {query && (
        <p className="mb-4 text-gray-600">
          找到约 {totalHits} 个文档结果 (搜索词：{query})
        </p>
      )}

      {/* 文档列表 */}
      <DocList docs={hits} query={query} />

      {/* 分页 */}
      {totalHits > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          query={query}
          searchType="doc"
        />
      )}
    </>
  );
}
