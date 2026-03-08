import { describe, test, expect } from "bun:test";
import { buildDemographicDistribution } from "../../../src/services/agentService";

describe("AgentService", () => {
  test("buildDemographicDistribution for fin_sentiment produces 3 groups with 60 retail for 100 agents", () => {
    const groups = buildDemographicDistribution("fin_sentiment", 100);
    expect(groups).toHaveLength(3);
    const retail = groups.find((g) => g.group_name === "retail_investor");
    expect(retail).toBeDefined();
    expect(retail!.count).toBe(60);
  });

  test("buildDemographicDistribution for crisis_pr produces 4 groups with 50 consumer for 100 agents", () => {
    const groups = buildDemographicDistribution("crisis_pr", 100);
    expect(groups).toHaveLength(4);
    const consumer = groups.find((g) => g.group_name === "consumer");
    expect(consumer).toBeDefined();
    expect(consumer!.count).toBe(50);
  });

  test("counts sum to total agentCount for 73 agents", () => {
    const groups = buildDemographicDistribution("policy_lab", 73);
    const total = groups.reduce((sum, g) => sum + g.count, 0);
    expect(total).toBe(73);
  });
});
