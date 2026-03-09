import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockQuery = mock(() =>
  Promise.resolve({
    rows: [
      {
        id: 1,
        simulation_id: "sim-001",
        branch_id: "branch-001",
        agent_id: "agent-001",
        event_type: "message",
        platform: "twitter",
        content: "Hello world",
        sim_timestamp: 100,
        metadata: { key: "value" },
      },
    ],
  })
);

mock.module("../../../../src/db/client", () => ({
  query: mockQuery,
}));

const { insertSimulationEvent } = await import(
  "../../../../src/db/queries/simulations"
);

describe("insertSimulationEvent", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  test("inserts event with all fields populated", async () => {
    const params = {
      simulationId: "sim-001",
      eventType: "message",
      agentId: "agent-001",
      branchId: "branch-001",
      platform: "twitter",
      content: "Hello world",
      simTimestamp: 100,
      metadata: { key: "value" },
    };

    const result = await insertSimulationEvent(params);

    expect(result).toEqual({
      id: 1,
      simulation_id: "sim-001",
      branch_id: "branch-001",
      agent_id: "agent-001",
      event_type: "message",
      platform: "twitter",
      content: "Hello world",
      sim_timestamp: 100,
      metadata: { key: "value" },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [sql, queryParams] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO simulation_events");
    expect(sql).toContain("RETURNING *");
    expect(queryParams).toEqual([
      "sim-001",
      "message",
      "agent-001",
      "branch-001",
      "twitter",
      "Hello world",
      100,
      JSON.stringify({ key: "value" }),
    ]);
  });

  test("inserts event with optional fields as null", async () => {
    const params = {
      simulationId: "sim-002",
      eventType: "system",
    };

    await insertSimulationEvent(params);

    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [sql, queryParams] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO simulation_events");
    expect(queryParams).toEqual([
      "sim-002",
      "system",
      null,
      null,
      null,
      null,
      0,
      JSON.stringify({}),
    ]);
  });

  test("SQL contains correct INSERT statement", async () => {
    await insertSimulationEvent({
      simulationId: "sim-003",
      eventType: "action",
    });

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO simulation_events");
    expect(sql).toContain(
      "(simulation_id, event_type, agent_id, branch_id, platform, content, sim_timestamp, metadata)"
    );
    expect(sql).toContain("VALUES ($1, $2, $3, $4, $5, $6, $7, $8)");
  });
});
