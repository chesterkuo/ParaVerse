import { describe, test, expect } from "bun:test";
import { buildCacheKey } from "../../../src/services/llmCacheService";

describe("llmCacheService", () => {
  describe("buildCacheKey", () => {
    const model = "gemini-2.5-flash";
    const messages = [{ role: "user", content: "Hello" }];
    const params = { temperature: 0.7 };

    test("returns deterministic key for same inputs", () => {
      const key1 = buildCacheKey(model, messages, params);
      const key2 = buildCacheKey(model, messages, params);
      expect(key1).toBe(key2);
    });

    test("key has correct prefix", () => {
      const key = buildCacheKey(model, messages, params);
      expect(key.startsWith("llm:cache:")).toBe(true);
    });

    test("different params produce different keys", () => {
      const key1 = buildCacheKey(model, messages, { temperature: 0.7 });
      const key2 = buildCacheKey(model, messages, { temperature: 0.9 });
      expect(key1).not.toBe(key2);
    });

    test("different messages produce different keys", () => {
      const key1 = buildCacheKey(model, [{ role: "user", content: "Hello" }], params);
      const key2 = buildCacheKey(model, [{ role: "user", content: "Goodbye" }], params);
      expect(key1).not.toBe(key2);
    });

    test("different models produce different keys", () => {
      const key1 = buildCacheKey("model-a", messages, params);
      const key2 = buildCacheKey("model-b", messages, params);
      expect(key1).not.toBe(key2);
    });

    test("key contains a valid SHA-256 hex hash after prefix", () => {
      const key = buildCacheKey(model, messages, params);
      const hash = key.replace("llm:cache:", "");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
