import { describe, test, expect } from "bun:test";
import { parseJsonlLine, serializeCommand } from "../../../../src/services/runners/baseRunner";

describe("BaseRunner utilities", () => {
  test("parseJsonlLine parses valid JSON", () => {
    const event = parseJsonlLine('{"type":"agent_action","agent_id":"a1","content":"hello"}');
    expect(event).not.toBeNull();
    expect(event!.type).toBe("agent_action");
    expect(event!.agent_id).toBe("a1");
  });

  test("parseJsonlLine returns null for invalid JSON", () => {
    const event = parseJsonlLine("not valid json{{{");
    expect(event).toBeNull();
  });

  test("parseJsonlLine returns null for empty string", () => {
    const event = parseJsonlLine("");
    expect(event).toBeNull();
  });

  test("serializeCommand produces valid JSON line with newline", () => {
    const cmd = { type: "start_simulation" as const, simulation_id: "sim1" };
    const line = serializeCommand(cmd);
    expect(line.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(line.trim());
    expect(parsed.type).toBe("start_simulation");
    expect(parsed.simulation_id).toBe("sim1");
  });
});
