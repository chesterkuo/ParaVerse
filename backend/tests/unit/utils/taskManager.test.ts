import { describe, test, expect } from "bun:test";
import { TaskType } from "../../../src/utils/taskManager";

describe("taskManager", () => {
  test("TaskType enum has correct values", () => {
    expect(TaskType.DOCUMENT_PROCESS).toBe("document_process");
    expect(TaskType.GRAPH_BUILD).toBe("graph_build");
    expect(TaskType.SIMULATION).toBe("simulation");
    expect(TaskType.REPORT_GENERATE).toBe("report_generate");
  });
});
