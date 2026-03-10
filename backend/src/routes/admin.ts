import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { AuthContext } from "../middleware/auth";
import { createApprovalRequest, getApprovalsByStatus, reviewApproval, getApprovalByUserId } from "../db/queries/organizationApprovals";
import { z } from "zod";

const admin = new Hono();

const requestSchema = z.object({
  organization_name: z.string().min(2).max(200),
  organization_type: z.enum(["academic", "think_tank", "government", "enterprise"]),
  justification: z.string().min(10).max(2000),
});

admin.post("/wargame-request", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = requestSchema.parse(await c.req.json());
  const existing = await getApprovalByUserId(auth.userId);
  if (existing && existing.status === "pending") {
    return c.json({ success: false, error: "You already have a pending request" }, 409);
  }
  const approval = await createApprovalRequest(auth.userId, body.organization_name, body.organization_type, body.justification);
  return c.json({ success: true, data: approval }, 201);
});

admin.get("/wargame-approvals", authMiddleware, async (c) => {
  const status = c.req.query("status") || "pending";
  const approvals = await getApprovalsByStatus(status);
  return c.json({ success: true, data: approvals });
});

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

admin.patch("/wargame-approvals/:id", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const approvalId = c.req.param("id");
  const body = reviewSchema.parse(await c.req.json());
  const result = await reviewApproval(approvalId, body.status, auth.userId, body.notes);
  if (!result) return c.json({ success: false, error: "Approval not found" }, 404);
  return c.json({ success: true, data: result });
});

admin.get("/wargame-request/me", authMiddleware, async (c) => {
  const auth = c.get("auth") as AuthContext;
  const approval = await getApprovalByUserId(auth.userId);
  return c.json({ success: true, data: approval });
});

export { admin };
