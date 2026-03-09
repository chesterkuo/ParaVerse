import { query } from "../db/client";
import { logger } from "../utils/logger";
import type {
  AcceptanceMatrix,
  StakeholderAcceptance,
} from "@shared/types/simulation";

interface EventRow {
  branch_id: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
}

const POSITIVE_KEYWORDS = ["support", "agree", "approve", "endorse", "favor", "accept"];
const NEGATIVE_KEYWORDS = ["oppose", "reject", "disagree", "resist", "deny", "refuse"];

function classifySentiment(content: string | null): "positive" | "neutral" | "negative" {
  if (!content) return "neutral";
  const lower = content.toLowerCase();
  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) return "positive";
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) return "negative";
  }
  return "neutral";
}

export async function computeAcceptanceMatrix(
  simulationId: string
): Promise<AcceptanceMatrix> {
  const result = await query<EventRow>(
    `SELECT branch_id, content, metadata
     FROM simulation_events
     WHERE simulation_id = $1 AND event_type = 'agent_action'
     ORDER BY sim_timestamp ASC`,
    [simulationId]
  );

  const events = result.rows;
  logger.debug(
    { simulationId, eventCount: events.length },
    "Computing acceptance matrix"
  );

  // Group events by (stakeholder_group, branch_label)
  const groupsSet = new Set<string>();
  const branchesSet = new Set<string>();

  interface Tally {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }

  const cellMap = new Map<string, Tally>();

  for (const event of events) {
    const group =
      (event.metadata?.stakeholder_group as string) ?? "unknown";
    const branch = event.branch_id ?? "main";

    groupsSet.add(group);
    branchesSet.add(branch);

    const key = `${group}::${branch}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { positive: 0, neutral: 0, negative: 0, total: 0 });
    }

    const tally = cellMap.get(key)!;
    const sentiment = classifySentiment(event.content);
    tally[sentiment]++;
    tally.total++;
  }

  const groups = Array.from(groupsSet).sort();
  const branches = Array.from(branchesSet).sort();

  const cells: StakeholderAcceptance[] = [];
  for (const group of groups) {
    for (const branch of branches) {
      const key = `${group}::${branch}`;
      const tally = cellMap.get(key);
      if (!tally || tally.total === 0) continue;

      const acceptance_score =
        ((tally.positive + tally.neutral * 0.5) / tally.total) * 100;

      let sentiment: "positive" | "neutral" | "negative";
      if (acceptance_score >= 60) sentiment = "positive";
      else if (acceptance_score >= 40) sentiment = "neutral";
      else sentiment = "negative";

      cells.push({
        stakeholder_group: group,
        branch_label: branch,
        acceptance_score: Math.round(acceptance_score * 100) / 100,
        sentiment,
        sample_size: tally.total,
      });
    }
  }

  return {
    simulation_id: simulationId,
    groups,
    branches,
    cells,
    generated_at: new Date().toISOString(),
  };
}
