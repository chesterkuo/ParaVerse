import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getProject } from "../db/queries/projects";
import { createTask, updateTask } from "../db/queries/tasks";
import { getDocumentService } from "../services/documentService";
import { getGraphService } from "../services/graphService";
import type { ApiResponse } from "@shared/types/api";

const graph = new Hono();

graph.use("*", authMiddleware);

// Upload document for a project
graph.post("/:projectId/documents", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new HTTPException(400, { message: "No file provided" });

  const buffer = Buffer.from(await file.arrayBuffer());
  const docService = getDocumentService();

  const task = await createTask("document_process", projectId, auth.userId);

  // Process async
  docService
    .processDocument({
      projectId,
      filename: file.name,
      buffer,
      onProgress: (progress) => {
        updateTask(task.id, { progress }).catch(() => {});
      },
    })
    .then((result) => {
      updateTask(task.id, {
        status: "completed",
        progress: 100,
        result: result as unknown as Record<string, unknown>,
      });
    })
    .catch((err) => {
      updateTask(task.id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

  return c.json(
    {
      success: true,
      data: { taskId: task.id },
      error: null,
    } satisfies ApiResponse,
    202
  );
});

// Build knowledge graph
graph.post("/:projectId/graph/build", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const body = await c.req.json().catch(() => ({}));
  const chunks = (body.chunks as string[]) || [];

  if (chunks.length === 0) {
    throw new HTTPException(400, { message: "No chunks provided" });
  }

  const task = await createTask("graph_build", projectId, auth.userId);
  const graphService = getGraphService();

  graphService
    .extractOntology(projectId, chunks, (progress) => {
      updateTask(task.id, { progress }).catch(() => {});
    })
    .then((result) => {
      updateTask(task.id, {
        status: "completed",
        progress: 100,
        result: result as unknown as Record<string, unknown>,
      });
    })
    .catch((err) => {
      updateTask(task.id, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

  return c.json(
    {
      success: true,
      data: { taskId: task.id },
      error: null,
    } satisfies ApiResponse,
    202
  );
});

// Get knowledge graph
graph.get("/:projectId/graph", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const graphService = getGraphService();
  const data = await graphService.getGraph(projectId);

  return c.json({
    success: true,
    data,
    error: null,
  } satisfies ApiResponse);
});

// Search knowledge graph
graph.post("/:projectId/graph/search", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const body = await c.req.json();
  const searchSchema = z.object({
    query: z.string().min(1),
    limit: z.number().int().positive().optional(),
  });
  const input = searchSchema.parse(body);

  const graphService = getGraphService();
  const results = await graphService.searchGraph(
    projectId,
    input.query,
    input.limit
  );

  return c.json({
    success: true,
    data: results,
    error: null,
  } satisfies ApiResponse);
});

export { graph };
