import { getLlmService } from "./llmService";
import { getVectorService } from "./vectorService";
import { logger } from "../utils/logger";
import type { ScenarioType } from "@shared/types/project";

export interface DemographicGroup {
  group_name: string;
  count: number;
  percentage: number;
  traits: Record<string, string>;
}

const SCENARIO_DEMOGRAPHICS: Record<ScenarioType, { group_name: string; percentage: number; traits: Record<string, string> }[]> = {
  fin_sentiment: [
    { group_name: "retail_investor", percentage: 60, traits: { risk_tolerance: "moderate", info_source: "social_media" } },
    { group_name: "media_analyst", percentage: 20, traits: { risk_tolerance: "low", info_source: "financial_reports" } },
    { group_name: "institutional", percentage: 20, traits: { risk_tolerance: "calculated", info_source: "proprietary_data" } },
  ],
  crisis_pr: [
    { group_name: "consumer", percentage: 50, traits: { loyalty: "neutral", voice: "complaint" } },
    { group_name: "media_reporter", percentage: 20, traits: { loyalty: "none", voice: "investigative" } },
    { group_name: "brand_loyalist", percentage: 15, traits: { loyalty: "high", voice: "defensive" } },
    { group_name: "critic", percentage: 15, traits: { loyalty: "none", voice: "aggressive" } },
  ],
  content_lab: [
    { group_name: "hardcore_fan", percentage: 30, traits: { engagement: "high", content_type: "deep_analysis" } },
    { group_name: "casual_fan", percentage: 40, traits: { engagement: "medium", content_type: "reactions" } },
    { group_name: "passerby", percentage: 30, traits: { engagement: "low", content_type: "brief_comments" } },
  ],
  policy_lab: [
    { group_name: "supporter", percentage: 35, traits: { stance: "for", intensity: "moderate" } },
    { group_name: "opponent", percentage: 35, traits: { stance: "against", intensity: "moderate" } },
    { group_name: "undecided", percentage: 30, traits: { stance: "neutral", intensity: "low" } },
  ],
  war_game: [
    { group_name: "domestic_public", percentage: 40, traits: { perspective: "internal", concern: "safety" } },
    { group_name: "foreign_public", percentage: 30, traits: { perspective: "external", concern: "stability" } },
    { group_name: "media", percentage: 15, traits: { perspective: "observational", concern: "narrative" } },
    { group_name: "diplomat", percentage: 15, traits: { perspective: "strategic", concern: "negotiation" } },
  ],
  train_lab: [
    { group_name: "stakeholder", percentage: 50, traits: { role: "affected_party", priority: "outcomes" } },
    { group_name: "media", percentage: 25, traits: { role: "observer", priority: "reporting" } },
    { group_name: "regulator", percentage: 25, traits: { role: "oversight", priority: "compliance" } },
  ],
};

export function buildDemographicDistribution(
  scenarioType: ScenarioType,
  agentCount: number
): DemographicGroup[] {
  const template = SCENARIO_DEMOGRAPHICS[scenarioType];
  if (!template) {
    throw new Error(`Unknown scenario type: ${scenarioType}`);
  }

  let allocated = 0;
  const groups: DemographicGroup[] = template.map((t, i) => {
    const isLast = i === template.length - 1;
    const count = isLast
      ? agentCount - allocated
      : Math.round((t.percentage / 100) * agentCount);
    allocated += count;
    return {
      group_name: t.group_name,
      count,
      percentage: t.percentage,
      traits: t.traits,
    };
  });

  return groups;
}

const PERSONA_PROMPT = `You are a persona generator for social simulation agents.
Given a demographic group and traits, generate a unique, realistic persona.
Return a JSON object with: name, age, occupation, background, personality_traits (array), communication_style, and core_beliefs (array).
Make each persona distinct and internally consistent.`;

export class AgentService {
  private get llm() {
    return getLlmService();
  }

  private get vectors() {
    return getVectorService();
  }

  async generateAgents(
    simulationId: string,
    scenarioType: ScenarioType,
    agentCount: number
  ): Promise<string[]> {
    const distribution = buildDemographicDistribution(scenarioType, agentCount);
    const agentIds: string[] = [];
    const batchSize = 5;

    for (const group of distribution) {
      for (let i = 0; i < group.count; i += batchSize) {
        const batchCount = Math.min(batchSize, group.count - i);
        const batch = Array.from({ length: batchCount }, (_, idx) =>
          this.generateSingleAgent(simulationId, group, i + idx)
        );
        const ids = await Promise.all(batch);
        agentIds.push(...ids);
      }
    }

    logger.info(
      { simulationId, agentCount: agentIds.length, scenarioType },
      "Generated agents"
    );
    return agentIds;
  }

  private async generateSingleAgent(
    simulationId: string,
    group: DemographicGroup,
    index: number
  ): Promise<string> {
    const persona = await this.llm.chatJson<{
      name: string;
      age: number;
      occupation: string;
      background: string;
      personality_traits: string[];
      communication_style: string;
      core_beliefs: string[];
    }>(
      [
        { role: "system", content: PERSONA_PROMPT },
        {
          role: "user",
          content: `Generate persona #${index + 1} for group "${group.group_name}" with traits: ${JSON.stringify(group.traits)}`,
        },
      ],
      { temperature: 0.9 }
    );

    const personaText = `${persona.name}: ${persona.background}. Style: ${persona.communication_style}. Beliefs: ${persona.core_beliefs.join(", ")}`;
    const embedding = await this.llm.embedSingle(personaText);

    const id = await this.vectors.upsertAgentProfile({
      simulationId,
      name: persona.name,
      persona: personaText,
      embedding,
      demographics: {
        group: group.group_name,
        age_range: `${persona.age - 5}-${persona.age + 5}`,
        gender: "unspecified",
        occupation: persona.occupation,
        personality_type: persona.personality_traits.join(", "),
        ...group.traits,
      },
    });

    return id;
  }
}

let instance: AgentService | null = null;
export function getAgentService(): AgentService {
  if (!instance) instance = new AgentService();
  return instance;
}
