import { describe, it, expect } from "bun:test";
import { z } from "zod";

describe("Admin approval validation", () => {
  const requestSchema = z.object({
    organization_name: z.string().min(2).max(200),
    organization_type: z.enum(["academic", "think_tank", "government", "enterprise"]),
    justification: z.string().min(10).max(2000),
  });

  it("should accept valid academic request", () => {
    const result = requestSchema.safeParse({
      organization_name: "National Defense University",
      organization_type: "academic",
      justification: "Research on cognitive warfare defense strategies for graduate program.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject request with invalid org type", () => {
    const result = requestSchema.safeParse({
      organization_name: "Some Corp",
      organization_type: "startup",
      justification: "Want to use wargame features.",
    });
    expect(result.success).toBe(false);
  });

  it("should reject request with short justification", () => {
    const result = requestSchema.safeParse({
      organization_name: "University",
      organization_type: "academic",
      justification: "Research",
    });
    expect(result.success).toBe(false);
  });
});
