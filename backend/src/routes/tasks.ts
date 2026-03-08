import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import { getTask } from "../db/queries/tasks";
import type { ApiResponse } from "@shared/types/api";

const tasks = new Hono();

tasks.use("*", authMiddleware);

// Get task status
tasks.get("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const task = await getTask(taskId);
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  return c.json({
    success: true,
    data: task,
    error: null,
  } satisfies ApiResponse);
});

export { tasks };
