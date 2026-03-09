import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getProject } from "../db/queries/projects";
import { createTask, updateTask } from "../db/queries/tasks";
import { getDocumentService } from "../services/documentService";
import { getGraphService } from "../services/graphService";
import { hybridSearch } from "../services/hybridSearchService";
import { query } from "../db/client";
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
  let chunks = (body.chunks as string[]) || [];

  // If no chunks provided, fetch from stored documents
  if (chunks.length === 0) {
    const docs = await query<{ content: string }>(
      "SELECT content FROM documents WHERE project_id = $1 ORDER BY chunk_index",
      [projectId]
    );
    chunks = docs.rows.map((r) => r.content);
  }

  if (chunks.length === 0) {
    throw new HTTPException(400, { message: "No documents found. Upload a document first." });
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

// Hybrid search across project data
graph.post("/:projectId/search", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const projectId = c.req.param("projectId");

  const project = await getProject(projectId, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const body = await c.req.json();
  const searchSchema = z.object({
    query: z.string().min(1, "query must be a non-empty string"),
    mode: z.enum(["hybrid", "vector", "text"]).optional(),
    limit: z.number().int().positive().optional(),
    table: z.enum(["documents", "simulation_events", "ontology_nodes"]).optional(),
  });

  let input: z.infer<typeof searchSchema>;
  try {
    input = searchSchema.parse(body);
  } catch (err: any) {
    if (err?.issues || err?.errors) {
      const issues = err.issues ?? err.errors;
      const msg = issues?.[0]?.message ?? "Invalid input";
      throw new HTTPException(400, { message: msg });
    }
    throw err;
  }

  const limit = Math.min(input.limit ?? 10, 50);
  const table = input.table ?? "documents";
  const mode = input.mode ?? "hybrid";

  const results = await hybridSearch({
    query: input.query,
    projectId,
    table,
    limit,
    mode,
  });

  return c.json({
    success: true,
    data: { results, total: results.length, mode },
    error: null,
  } satisfies ApiResponse);
});

export { graph };
