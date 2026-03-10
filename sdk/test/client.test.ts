import { describe, it, expect } from "bun:test";
import { createParaVerseClient } from "../src/index";

describe("ParaVerse SDK client", () => {
  it("should create client with config", () => {
    const client = createParaVerseClient({ baseURL: "https://api.example.com", token: "test-token" });
    expect(client).toBeDefined();
    expect(typeof client.login).toBe("function");
    expect(typeof client.listProjects).toBe("function");
    expect(typeof client.createSimulation).toBe("function");
    expect(typeof client.getReport).toBe("function");
    expect(typeof client.requestWarGameAccess).toBe("function");
  });

  it("should create client without token", () => {
    const client = createParaVerseClient({ baseURL: "https://api.example.com" });
    expect(client).toBeDefined();
  });

  it("should allow updating token", () => {
    const client = createParaVerseClient({ baseURL: "https://api.example.com" });
    client.setToken("new-token");
    expect(client).toBeDefined();
  });
});
