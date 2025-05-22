import { searchArticles } from "@/services/article";
import { ArticleDocument } from "@/lib/types";
import Pagination from "./pagination";
import Link from "next/link";
import HighlightText from "./highlight-text";

// 文章列表组件
function ArticleList({
  articles,
  query,
}: {
  articles: ArticleDocument[];
  query: string;
}) {
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
          <Link
            href={`https://apollo.baidu.com/community/article/${article.id}`}
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
  );
}

interface ArticleSearchResultsProps {
  query: string;
  page: number;
  limit: number;
}

export default async function ArticleSearchResults({
  query,
  page,
  limit,
}: ArticleSearchResultsProps) {
  // 在服务器端执行搜索
  const { hits, totalHits } = await searchArticles(query, page, limit);
  const totalPages = Math.ceil(totalHits / limit);

  return (
    <>
      {/* 搜索结果统计 */}
      {query && (
        <p className="mb-4 text-gray-600">
          找到约 {totalHits} 个文章结果 (搜索词：{query})
        </p>
      )}

      {/* 文章列表 */}
      <ArticleList articles={hits} query={query} />

      {/* 分页 */}
      {totalHits > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          query={query}
          searchType="article"
        />
      )}
    </>
  );
}
