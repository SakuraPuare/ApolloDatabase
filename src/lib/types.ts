export interface ArticleDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  publishTimestamp: number;
  publishDateStr: string;
  author: string;
  views: number;
  likes: number;
}

export enum SearchType {
  Article = "article",
}

export interface SearchResult {
  hits: ArticleDocument[];
  totalHits: number;
}
