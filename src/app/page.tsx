import Link from "next/link";

export default function HomePage() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">Apollo 数据库</h1>
        <p className="text-xl text-gray-600 mb-10">
          一站式搜索百度 Apollo 官网的文章内容，获取自动驾驶技术的最新资讯
        </p>

        <div className="flex justify-center">
          <Link
            href="/search"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-lg"
          >
            开始搜索
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-xl font-medium mb-3">全面收录</h3>
            <p className="text-gray-600">
              收录百度 Apollo 官网全站文章，内容持续更新
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-xl font-medium mb-3">边缘部署</h3>
            <p className="text-gray-600">
              部署在 Cloudflare 全球边缘网络，搜索响应极速
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-xl font-medium mb-3">本地搜索</h3>
            <p className="text-gray-600">
              搜索引擎运行在浏览器端，无需后端服务器
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
