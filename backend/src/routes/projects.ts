import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import {
  createProject,
  getProjectsByOwner,
  getProject,
  deleteProject,
} from "../db/queries/projects";
import type { ApiResponse } from "@shared/types/api";

const VALID_SCENARIO_TYPES = [
  "fin_sentiment",
  "content_lab",
  "crisis_pr",
  "policy_lab",
  "war_game",
  "train_lab",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  scenario_type: z.enum(VALID_SCENARIO_TYPES),
  settings: z.record(z.unknown()).optional(),
});

const projects = new Hono();

projects.use("*", authMiddleware);

projects.post("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();
  const input = createSchema.parse(body);

  const project = await createProject({
    name: input.name,
    scenarioType: input.scenario_type,
    ownerId: auth.userId,
    settings: input.settings,
  });

  return c.json(
    {
      success: true,
      data: project,
      error: null,
    } satisfies ApiResponse,
    201
  );
});

projects.get("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const cursor = c.req.query("cursor");
  const limit = c.req.query("limit")
    ? parseInt(c.req.query("limit")!)
    : undefined;

  const { rows, hasMore } = await getProjectsByOwner(auth.userId, {
    cursor,
    limit,
  });

  const nextCursor =
    hasMore && rows.length > 0
      ? rows[rows.length - 1].created_at
      : undefined;

  return c.json({
    success: true,
    data: rows,
    error: null,
    meta: { cursor: nextCursor, has_more: hasMore },
  } satisfies ApiResponse);
});

projects.get("/:projectId", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  return c.json({
    success: true,
    data: project,
    error: null,
  } satisfies ApiResponse);
});

projects.delete("/:projectId", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const deleted = await deleteProject(projectId, auth.userId);
  if (!deleted) throw new HTTPException(404, { message: "Project not found" });

  return c.json({
    success: true,
    data: { deleted: true },
    error: null,
  } satisfies ApiResponse);
});

export { projects };
