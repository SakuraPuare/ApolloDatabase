import { NextRequest, NextResponse } from "next/server";
import { searchArticles } from "@/lib/meilisearch";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // 获取查询参数
  const query = url.searchParams.get("q") || "";
  const pageStr = url.searchParams.get("page") || "1";
  const limitStr = url.searchParams.get("limit") || "10";

  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  try {
    // 使用 meilisearch 执行搜索
    const { hits, totalHits } = await searchArticles(query, page, limit);

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        hits,
        totalHits,
        page,
        limit,
        query,
      },
    });
  } catch (error) {
    console.error("搜索 API 错误：", error);
    return NextResponse.json(
      {
        success: false,
        error: "搜索时出错，请稍后再试",
      },
      { status: 500 },
    );
  }
}
