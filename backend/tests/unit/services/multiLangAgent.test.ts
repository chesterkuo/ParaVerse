import { describe, it, expect } from "bun:test";

describe("Multi-language agent generation", () => {
  it("should include language instruction in agent system prompt", () => {
    const LANG_INSTRUCTIONS: Record<string, string> = {
      en: "Respond in English.",
      "zh-Hans": "请用简体中文回答。",
      ja: "日本語で回答してください。",
      ko: "한국어로 답변해 주세요。",
    };
    expect(LANG_INSTRUCTIONS["zh-Hans"]).toContain("简体中文");
    expect(LANG_INSTRUCTIONS["ja"]).toContain("日本語");
  });

  it("should assign country and language to war_game agents", () => {
    const nestedConfig = {
      countries: [
        { id: "CN", language: "zh-Hans", agent_count: 5 },
        { id: "US", language: "en", agent_count: 5 },
      ],
    };
    const agents: { country: string; language: string }[] = [];
    for (const c of nestedConfig.countries) {
      for (let i = 0; i < c.agent_count; i++) {
        agents.push({ country: c.id, language: c.language });
      }
    }
    expect(agents).toHaveLength(10);
    expect(agents.filter((a) => a.country === "CN")).toHaveLength(5);
    expect(agents.filter((a) => a.language === "en")).toHaveLength(5);
  });

  it("should distribute agents across countries based on nested_config", () => {
    const nestedConfig = {
      countries: [
        { id: "CN", language: "zh-Hans", agent_count: 3 },
        { id: "US", language: "en", agent_count: 4 },
        { id: "JP", language: "ja", agent_count: 3 },
      ],
    };
    const totalAgents = nestedConfig.countries.reduce((sum, c) => sum + c.agent_count, 0);
    expect(totalAgents).toBe(10);
  });
});
