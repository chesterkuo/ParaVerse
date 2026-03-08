export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
  meta?: { cursor?: string; has_more?: boolean; total?: number };
}

export interface TaskStatus {
  id: string;
  type: "document_process" | "graph_build" | "simulation" | "report_generate";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}
