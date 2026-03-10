import { describe, it, expect } from "bun:test";

describe("WarGame nested config", () => {
  it("should validate nested_config structure", () => {
    const nestedConfig = {
      countries: [
        { id: "CN", language: "zh-Hans", agent_count: 10, trust_index_init: 50 },
        { id: "US", language: "en", agent_count: 10, trust_index_init: 60 },
        { id: "JP", language: "ja", agent_count: 8, trust_index_init: 55 },
      ],
    };
    expect(nestedConfig.countries).toHaveLength(3);
    for (const c of nestedConfig.countries) {
      expect(c.id).toBeTruthy();
      expect(c.language).toBeTruthy();
      expect(c.agent_count).toBeGreaterThan(0);
      expect(c.trust_index_init).toBeGreaterThanOrEqual(0);
      expect(c.trust_index_init).toBeLessThanOrEqual(100);
    }
  });

  it("should generate per-country grounded variable keys", () => {
    const countries = ["CN", "US", "JP"];
    const vars: Record<string, number> = {};
    for (const c of countries) {
      vars[`${c}_trust_index`] = 50;
      vars[`${c}_belief_score`] = 50;
    }
    vars["information_penetration_rate"] = 0;
    expect(Object.keys(vars)).toHaveLength(7);
  });
});
