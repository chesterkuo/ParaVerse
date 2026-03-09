import { api } from "./client";
import type { ApiResponse } from "@shared/types/api";

export interface SearchResult {
  id: string;
  title?: string;
  content: string;
  score: number;
  source: string;
}

export interface SearchOptions {
  mode?: "hybrid" | "semantic" | "keyword";
  limit?: number;
  table?: string;
}

export const searchApi = {
  search: (projectId: string, query: string, options?: SearchOptions) =>
    api.post<ApiResponse<SearchResult[]>>(
      `/projects/${projectId}/search`,
      { query, ...options },
    ),
};
