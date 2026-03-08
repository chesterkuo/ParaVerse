export interface ReportSection {
  id: string;
  simulation_id: string;
  section_order: number;
  title: string;
  content: string;
  tool_calls: ToolCallRecord[];
  created_at: string;
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  timestamp: string;
}

export interface Report {
  simulation_id: string;
  sections: ReportSection[];
  generated_at: string;
}
