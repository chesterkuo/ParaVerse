import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getTask } from "../db/queries/tasks";
import type { ApiResponse } from "@shared/types/api";

const tasks = new Hono();

tasks.use("*", authMiddleware);

// Get task status
tasks.get("/:taskId", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const taskId = c.req.param("taskId");

  const task = await getTask(taskId);
  if (!task || task.owner_id !== auth.userId) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  return c.json({
    success: true,
    data: task,
    error: null,
  } satisfies ApiResponse);
});

export { tasks };
