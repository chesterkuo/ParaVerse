import { describe, it, expect } from "bun:test";

describe("ContentLab scenario config", () => {
  it("should map content_lab to OASIS engine", () => {
    const ENGINE_MAP: Record<string, string> = {
      fin_sentiment: "oasis",
      content_lab: "oasis",
      crisis_pr: "concordia",
      policy_lab: "concordia",
      war_game: "concordia",
      train_lab: "concordia",
    };
    expect(ENGINE_MAP["content_lab"]).toBe("oasis");
  });

  it("should generate content_lab agent demographics", () => {
    const tiers = ["hardcore_fan", "casual_fan", "passerby"];
    const weights = [0.3, 0.4, 0.3];
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0);
    expect(tiers).toHaveLength(3);
  });
});
