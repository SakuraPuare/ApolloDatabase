import Link from "next/link";
import { DocDocument } from "@/lib/types";
import HighlightText from "@/components/search/highlight-text";

interface DocListProps {
  docs: DocDocument[];
  query: string;
}

export default function DocList({ docs, query }: DocListProps) {
  if (docs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600">未找到匹配的文档</p>
      </div>
    );
  }

  console.log("docs", docs);
  
  return (
    <div className="space-y-6">
      {docs.map((doc) => (
        <article
          key={doc.id}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
        >
          <Link href={doc.url}>
            <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600">
              <HighlightText text={doc.title} query={query} />
            </h2>
          </Link>


          <p className="text-gray-700">
            <HighlightText
              text={doc.content || "暂无内容"}
              query={query}
              maxLength={300}
            />
          </p>

          <div className="mt-4">
            <Link
              href={doc.url}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              target="_blank"
            >
              查看文档 →
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
