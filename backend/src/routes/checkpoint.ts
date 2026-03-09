import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { readdir, stat, access } from "node:fs/promises";
import { join } from "node:path";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getSimulationService } from "../services/simulationService";
import { getSimulationForOwner } from "../db/queries/simulations";
import type { ApiResponse } from "@shared/types/api";
import { logger } from "../utils/logger";

const CHECKPOINT_DIR =
  process.env.CHECKPOINT_DIR || "/tmp/paraverse_checkpoints";

const TICK_PATTERN = /^checkpoint_tick(\d+)\.pkl$/;

const loadSchema = z.object({
  filename: z.string().min(1),
});

const checkpoint = new Hono();

checkpoint.use("*", authMiddleware);

// List checkpoints for a simulation
checkpoint.get("/:simulationId/checkpoints", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const dir = join(CHECKPOINT_DIR, simulationId);

  try {
    await access(dir);
  } catch {
    // Directory doesn't exist — no checkpoints yet
    return c.json({
      success: true,
      data: [],
      error: null,
    } satisfies ApiResponse);
  }

  const entries = await readdir(dir);
  const checkpoints = [];

  for (const filename of entries) {
    const match = filename.match(TICK_PATTERN);
    if (!match) continue;

    const filePath = join(dir, filename);
    const fileStat = await stat(filePath);

    checkpoints.push({
      filename,
      tick: parseInt(match[1], 10),
      created_at: fileStat.mtime.toISOString(),
      size_bytes: fileStat.size,
    });
  }

  // Sort by tick ascending
  checkpoints.sort((a, b) => a.tick - b.tick);

  return c.json({
    success: true,
    data: checkpoints,
    error: null,
  } satisfies ApiResponse);
});

// Load a checkpoint for a simulation
checkpoint.post("/:simulationId/checkpoints/load", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  if (sim.engine !== "concordia") {
    throw new HTTPException(400, {
      message: "Checkpoint loading is only supported for Concordia simulations",
    });
  }

  const body = await c.req.json();
  const input = loadSchema.parse(body);

  const filePath = join(CHECKPOINT_DIR, simulationId, input.filename);

  try {
    await access(filePath);
  } catch {
    throw new HTTPException(404, { message: "Checkpoint file not found" });
  }

  const simService = getSimulationService();
  await simService.forwardCommand(simulationId, {
    type: "load_checkpoint",
    filename: input.filename,
  });

  logger.info(
    { simId: simulationId, filename: input.filename },
    "Checkpoint load requested"
  );

  return c.json({
    success: true,
    data: { loaded: true, filename: input.filename },
    error: null,
  } satisfies ApiResponse);
});

export { checkpoint };
