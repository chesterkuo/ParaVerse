import { describe, test, expect } from "bun:test";
import { LlmService } from "../../../src/services/llmService";

describe("LlmService", () => {
  test("constructs with correct config", () => {
    const service = new LlmService({
      apiKey: "test-key", baseURL: "https://test.example.com/v1",
      generalModel: "gemini-2.5-flash", boostModel: "gemini-2.5-flash",
    });
    expect(service).toBeDefined();
  });

  test("has required methods", () => {
    const service = new LlmService({
      apiKey: "test-key", baseURL: "https://test.example.com/v1",
      generalModel: "test-model", boostModel: "test-model",
    });
    expect(service.chat).toBeDefined();
    expect(service.chatJson).toBeDefined();
    expect(service.chatStream).toBeDefined();
    expect(service.embed).toBeDefined();
    expect(service.embedSingle).toBeDefined();
  });
});
