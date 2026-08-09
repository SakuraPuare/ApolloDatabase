"use client";

import { create, load, search as oramaSearch } from "@orama/orama";
import type { ArticleDocument, SearchResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbPromise: Promise<void> | null = null;

async function ensureDB(): Promise<void> {
  if (db) return;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const res = await fetch("/search-index/articles.json");
    const data = await res.json();

    db = create({
      schema: {
        id: "string",
        title: "string",
        content: "string",
        url: "string",
        author: "string",
        publishTimestamp: "number",
        publishDateStr: "string",
        views: "number",
        likes: "number",
      } as const,
    });

    load(db, data);
  })();

  return dbPromise;
}

export async function searchArticles(
  query: string,
  page: number = 1,
  limit: number = 10
): Promise<SearchResult> {
  await ensureDB();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any = oramaSearch(db, {
    term: query || "",
    limit: 10000,
    ...(query ? { properties: ["title", "content", "author"] } : {}),
  });

  let hits = results.hits;

  if (!query.trim()) {
    hits = [...hits].sort(
      (a: any, b: any) =>
        (b.document.publishTimestamp || 0) -
        (a.document.publishTimestamp || 0)
    );
  }

  const offset = (page - 1) * limit;
  const paged = hits.slice(offset, offset + limit);

  return {
    hits: paged.map((h: any) => h.document as ArticleDocument),
    totalHits: results.count,
  };
}

export async function preloadIndex(): Promise<void> {
  await ensureDB();
}
