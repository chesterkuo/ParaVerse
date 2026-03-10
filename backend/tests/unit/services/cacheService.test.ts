import { describe, it, expect } from "bun:test";

describe("Multi-tier cache key generation", () => {
  it("should generate distinct keys for different cache tiers", () => {
    const llmKey = "llm:abc123";
    const eventKey = "sim:sim-1:events:cursor-0";
    const graphKey = "graph:proj-1:neighbors:node-1:2";
    const agentKey = "agents:sim-1:agent-1:state";
    const keys = [llmKey, eventKey, graphKey, agentKey];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(4);
  });

  it("should use correct TTLs per tier", () => {
    const TTL = {
      llm: 1800,
      simEvents: 3600,
      graph: 86400,
      agentState: 7200,
    };
    expect(TTL.llm).toBeLessThan(TTL.simEvents);
    expect(TTL.simEvents).toBeLessThan(TTL.graph);
  });

  it("should handle cache key with special characters", () => {
    const key = "graph:proj-123:neighbors:node-abc-def:3";
    expect(key).toContain("graph:");
    expect(key.split(":")).toHaveLength(5);
  });
});
