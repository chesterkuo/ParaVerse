import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { getSimulation, getSimulationEvents } from "../db/queries/simulations";
import { getAgentsBySimulation } from "../db/queries/agents";
import {
  insertReportSection,
  getReportSections,
  deleteReportSections,
} from "../db/queries/reports";
import { createTask, updateTask } from "../db/queries/tasks";
import { logger } from "../utils/logger";
import type { ScenarioType } from "@shared/types/project";
import type { ToolCallRecord } from "@shared/types/report";

export interface ReportOutlineSection {
  title: string;
  prompt: string;
  tools: string[];
}

const BASE_OUTLINE: ReportOutlineSection[] = [
  {
    title: "Executive Summary",
    prompt:
      "Write a concise executive summary of the simulation results, highlighting the most important outcomes and their implications.",
    tools: ["events_summary", "agent_summary"],
  },
  {
    title: "Methodology",
    prompt:
      "Describe the simulation methodology, including agent composition, scenario configuration, and key parameters used.",
    tools: ["agent_summary"],
  },
  {
    title: "Key Findings",
    prompt:
      "Analyze the key findings from the simulation events. Identify patterns, trends, and notable agent behaviors.",
    tools: ["events_analysis", "events_summary", "vector_search"],
  },
  {
    title: "Sentiment Analysis",
    prompt:
      "Provide a detailed sentiment analysis across agents and time periods. Identify sentiment shifts and their triggers.",
    tools: ["sentiment_timeline", "events_analysis"],
  },
  {
    title: "Recommendations",
    prompt:
      "Based on the simulation findings, provide actionable recommendations and strategic insights.",
    tools: ["events_summary", "agent_summary", "vector_search"],
  },
];

const CRISIS_PR_EXTRA: ReportOutlineSection[] = [
  {
    title: "Strategy Comparison",
    prompt:
      "Compare the effectiveness of different crisis response strategies observed across simulation branches.",
    tools: ["branch_comparison", "events_analysis", "grounded_vars_timeline"],
  },
  {
    title: "Reputation Recovery Curve",
    prompt:
      "Analyze the reputation recovery trajectory across branches, identifying which strategies led to faster recovery.",
    tools: [
      "grounded_vars_timeline",
      "sentiment_timeline",
      "branch_comparison",
    ],
  },
];

export function buildReportOutline(
  scenarioType: ScenarioType
): ReportOutlineSection[] {
  const outline = [...BASE_OUTLINE];

  if (scenarioType === "crisis_pr") {
    // Insert crisis sections before Recommendations (last item)
    const recommendationsIndex = outline.length - 1;
    outline.splice(recommendationsIndex, 0, ...CRISIS_PR_EXTRA);
  }

  return outline;
}

export class ReportService {
  private get llm() {
    return getLlmService();
  }

  private get vectors() {
    return getVectorService();
  }

  async generateReport(
    simulationId: string,
    ownerId: string
  ): Promise<string> {
    const task = await createTask("report_generate", simulationId, ownerId);

    // Fire and forget - runs async
    this.doGenerate(simulationId, task.id).catch((err) => {
      logger.error({ err, simulationId, taskId: task.id }, "Report generation failed");
      updateTask(task.id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    });

    return task.id;
  }

  private async doGenerate(
    simulationId: string,
    taskId: string
  ): Promise<void> {
    await updateTask(taskId, { status: "running", progress: 0 });

    const sim = await getSimulation(simulationId);
    if (!sim) throw new Error(`Simulation not found: ${simulationId}`);

    const events = await getSimulationEvents(simulationId);
    const agents = await getAgentsBySimulation(simulationId);

    const scenarioType = (sim.config as Record<string, unknown>)
      .scenario_type as ScenarioType;
    const outline = buildReportOutline(scenarioType);

    // Clear any previous report sections
    await deleteReportSections(simulationId);

    const contextSummary = this.buildContextSummary(sim, agents.length);

    for (let i = 0; i < outline.length; i++) {
      const section = outline[i];
      const toolResults = await this.executeTools(
        section.tools,
        simulationId,
        sim,
        events,
        agents
      );

      const toolCallRecords: ToolCallRecord[] = toolResults.map((t) => ({
        tool: t.tool,
        input: t.input,
        output: t.output,
        timestamp: new Date().toISOString(),
      }));

      const sectionContent = await this.llm.chat(
        [
          {
            role: "system",
            content: `You are an expert simulation analyst generating a report section. Use the provided tool outputs and context to write a detailed, well-structured section.\n\nContext:\n${contextSummary}`,
          },
          {
            role: "user",
            content: `Section: "${section.title}"\n\nInstructions: ${section.prompt}\n\nTool Results:\n${toolResults.map((t) => `[${t.tool}]: ${t.output}`).join("\n\n")}`,
          },
        ],
        { tier: "boost", maxTokens: 2000 }
      );

      await insertReportSection({
        simulationId,
        sectionOrder: i,
        title: section.title,
        content: sectionContent,
        toolCalls: toolCallRecords,
      });

      await updateTask(taskId, {
        progress: Math.round(((i + 1) / outline.length) * 100),
      });
    }

    await updateTask(taskId, { status: "completed", progress: 100 });
    logger.info({ simulationId, taskId, sections: outline.length }, "Report generated");
  }

  private buildContextSummary(
    sim: Record<string, unknown>,
    agentCount: number
  ): string {
    const config = sim.config as Record<string, unknown>;
    return [
      `Simulation ID: ${sim.id}`,
      `Engine: ${sim.engine}`,
      `Status: ${sim.status}`,
      `Scenario: ${config.scenario_type || "unknown"}`,
      `Agent Count: ${agentCount}`,
      `Tick Count: ${config.tick_count || "unknown"}`,
      `Started: ${sim.started_at || "N/A"}`,
      `Completed: ${sim.completed_at || "N/A"}`,
    ].join("\n");
  }

  private async executeTools(
    tools: string[],
    simulationId: string,
    sim: Record<string, unknown>,
    events: Array<Record<string, unknown>>,
    agents: Array<Record<string, unknown>>
  ): Promise<Array<{ tool: string; input: Record<string, unknown>; output: string }>> {
    const results: Array<{
      tool: string;
      input: Record<string, unknown>;
      output: string;
    }> = [];

    for (const tool of tools) {
      try {
        const output = await this.executeSingleTool(
          tool,
          simulationId,
          sim,
          events,
          agents
        );
        results.push({ tool, input: { simulationId }, output });
      } catch (err) {
        logger.warn({ err, tool, simulationId }, "Tool execution failed");
        results.push({
          tool,
          input: { simulationId },
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    return results;
  }

  private async executeSingleTool(
    tool: string,
    simulationId: string,
    sim: Record<string, unknown>,
    events: Array<Record<string, unknown>>,
    agents: Array<Record<string, unknown>>
  ): Promise<string> {
    switch (tool) {
      case "events_summary": {
        const typeCount: Record<string, number> = {};
        for (const e of events) {
          const t = (e.event_type as string) || "unknown";
          typeCount[t] = (typeCount[t] || 0) + 1;
        }
        return `Total events: ${events.length}\nEvent types: ${JSON.stringify(typeCount, null, 2)}`;
      }

      case "agent_summary": {
        const summary = agents.map((a) => {
          const demo = a.demographics as Record<string, unknown>;
          return `- ${a.name}: ${demo?.group || "unknown"} (${demo?.occupation || "unknown"})`;
        });
        return `Total agents: ${agents.length}\n${summary.join("\n")}`;
      }

      case "events_analysis": {
        const sample = events.slice(0, 50);
        return `Sample of ${sample.length}/${events.length} events:\n${JSON.stringify(sample.map((e) => ({ type: e.event_type, content: (e.content as string)?.slice(0, 200), agent: e.agent_id, timestamp: e.sim_timestamp })), null, 2)}`;
      }

      case "sentiment_timeline": {
        const vars = (sim.grounded_vars as Record<string, number>) || {};
        return `Grounded variables (sentiment indicators):\n${JSON.stringify(vars, null, 2)}`;
      }

      case "branch_comparison": {
        const branches = new Set(
          events
            .filter((e) => e.branch_id)
            .map((e) => e.branch_id as string)
        );
        const branchData: Record<string, number> = {};
        for (const b of branches) {
          branchData[b] = events.filter((e) => e.branch_id === b).length;
        }
        return `Branches: ${branches.size}\nEvents per branch: ${JSON.stringify(branchData, null, 2)}`;
      }

      case "grounded_vars_timeline": {
        const vars = (sim.grounded_vars as Record<string, number>) || {};
        return `Current grounded variables:\n${JSON.stringify(vars, null, 2)}`;
      }

      case "vector_search": {
        try {
          const config = sim.config as Record<string, unknown>;
          const searchText = `${config.scenario_type} simulation key findings`;
          const embedding = await this.llm.embedSingle(searchText);
          const results = await this.vectors.similaritySearch({
            table: "simulation_events",
            embedding,
            simulationId,
            limit: 10,
          });
          return `Vector search results: ${results.length} relevant events found\n${JSON.stringify(results.map((r: Record<string, unknown>) => ({ content: (r.content as string)?.slice(0, 200), similarity: r.similarity })), null, 2)}`;
        } catch {
          return "Vector search unavailable for this simulation";
        }
      }

      default:
        return `Unknown tool: ${tool}`;
    }
  }
}

let instance: ReportService | null = null;
export function getReportService(): ReportService {
  if (!instance) instance = new ReportService();
  return instance;
}
