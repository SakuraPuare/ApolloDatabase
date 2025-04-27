import "./index.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="border-b border-gray-200">
          <div className="container mx-auto py-4 px-4">
            <nav className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold">
                Apollo 数据库
              </Link>
              <div className="flex gap-4">
                <Link
                  href="/search"
                  className="px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                >
                  搜索
                </Link>
              </div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-gray-200 mt-8">
          <div className="container mx-auto py-6 px-4 text-center text-gray-500">
            <p>Apollo 数据库 - 百度 Apollo 官网文章搜索</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
