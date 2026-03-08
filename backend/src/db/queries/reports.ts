import { query } from "../client";
import type { ToolCallRecord } from "@shared/types/report";

export interface ReportSectionRow {
  id: string;
  simulation_id: string;
  section_order: number;
  title: string;
  content: string;
  tool_calls: ToolCallRecord[];
  created_at: string;
}

export async function insertReportSection(params: {
  simulationId: string;
  sectionOrder: number;
  title: string;
  content: string;
  toolCalls: ToolCallRecord[];
}): Promise<ReportSectionRow> {
  const result = await query<ReportSectionRow>(
    `INSERT INTO report_sections (simulation_id, section_order, title, content, tool_calls)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.simulationId,
      params.sectionOrder,
      params.title,
      params.content,
      JSON.stringify(params.toolCalls),
    ]
  );
  return result.rows[0];
}

export async function getReportSections(
  simulationId: string
): Promise<ReportSectionRow[]> {
  const result = await query<ReportSectionRow>(
    `SELECT * FROM report_sections WHERE simulation_id = $1 ORDER BY section_order ASC`,
    [simulationId]
  );
  return result.rows;
}

export async function deleteReportSections(
  simulationId: string
): Promise<void> {
  await query(`DELETE FROM report_sections WHERE simulation_id = $1`, [
    simulationId,
  ]);
}
