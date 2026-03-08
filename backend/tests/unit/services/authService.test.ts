import { describe, test, expect } from "bun:test";
import { hashPassword, verifyPassword, generateTokens, verifyAccessToken } from "../../../src/services/authService";

describe("authService", () => {
  test("hashPassword produces argon2 hash", async () => {
    const hash = await hashPassword("test-password");
    expect(hash).toStartWith("$argon2");
  });
  test("verifyPassword true for correct", async () => {
    const hash = await hashPassword("test-password");
    expect(await verifyPassword("test-password", hash)).toBe(true);
  });
  test("verifyPassword false for wrong", async () => {
    const hash = await hashPassword("test-password");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  test("generateTokens returns access and refresh", async () => {
    const tokens = await generateTokens({ id: "test-id", email: "t@t.com", role: "user" });
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
  });
  test("verifyAccessToken decodes valid token", async () => {
    const tokens = await generateTokens({ id: "test-id", email: "t@t.com", role: "user" });
    const payload = await verifyAccessToken(tokens.access_token);
    expect(payload.sub).toBe("test-id");
    expect(payload.email).toBe("t@t.com");
  });
  test("verifyAccessToken throws for invalid", () => {
    expect(verifyAccessToken("invalid")).rejects.toThrow();
  });
});
