import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { authMiddleware, type AuthContext } from "../middleware/auth";
import { getSimulationService } from "../services/simulationService";
import { getAgentService } from "../services/agentService";
import { getProject } from "../db/queries/projects";
import {
  getSimulation,
  getSimulationForOwner,
  getSimulationEvents,
} from "../db/queries/simulations";
import { getAgentsBySimulation } from "../db/queries/agents";
import type { ApiResponse } from "@shared/types/api";
import { logger } from "../utils/logger";

const VALID_SCENARIO_TYPES = [
  "fin_sentiment",
  "content_lab",
  "crisis_pr",
  "policy_lab",
  "war_game",
  "train_lab",
] as const;

const createSchema = z.object({
  project_id: z.string().uuid(),
  config: z.object({
    scenario_type: z.enum(VALID_SCENARIO_TYPES),
    agent_count: z.number().int().positive(),
    tick_count: z.number().int().positive(),
    seed_context: z.string().min(1),
    platform: z.enum(["twitter", "reddit"]).optional(),
    branches: z
      .array(
        z.object({
          label: z.string(),
          description: z.string(),
          override_vars: z.record(z.unknown()),
        })
      )
      .optional(),
    custom_params: z.record(z.unknown()).optional(),
  }),
});

const simulation = new Hono();

simulation.use("*", authMiddleware);

// Create simulation (with agent generation)
simulation.post("/", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const body = await c.req.json();
  const input = createSchema.parse(body);

  const project = await getProject(input.project_id, auth.userId);
  if (!project) throw new HTTPException(404, { message: "Project not found" });

  const simService = getSimulationService();
  const sim = await simService.create(input.project_id, input.config);

  // Generate agents async
  const agentService = getAgentService();
  agentService
    .generateAgents(sim.id, input.config.scenario_type, input.config.agent_count)
    .catch((err) => {
      logger.error({ err, simId: sim.id }, "Agent generation failed");
    });

  return c.json(
    {
      success: true,
      data: sim,
      error: null,
    } satisfies ApiResponse,
    201
  );
});

// Start simulation
simulation.post("/:simulationId/start", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  // Fetch generated agents and include in config
  const agents = await getAgentsBySimulation(simulationId);
  if (agents.length === 0) {
    throw new HTTPException(400, { message: "No agents generated yet. Wait for agent generation to complete." });
  }

  const simService = getSimulationService();
  const config = {
    ...(sim.config as Record<string, unknown>),
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      persona: a.persona,
      demographics: a.demographics,
    })),
  };
  await simService.start(simulationId, config as any);

  return c.json({
    success: true,
    data: { started: true },
    error: null,
  } satisfies ApiResponse);
});

// Get simulation status
simulation.get("/:simulationId/status", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const simService = getSimulationService();
  const status = await simService.getStatus(simulationId);

  return c.json({
    success: true,
    data: status,
    error: null,
  } satisfies ApiResponse);
});

// Get simulation events
simulation.get("/:simulationId/events", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const limitRaw = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;
  const offsetRaw = c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined;
  const limit = limitRaw && limitRaw > 0 && limitRaw <= 10000 ? limitRaw : undefined;
  const offset = offsetRaw && offsetRaw >= 0 ? offsetRaw : undefined;
  const eventType = c.req.query("event_type") || undefined;

  const events = await getSimulationEvents(simulationId, {
    limit,
    offset,
    eventType,
  });

  return c.json({
    success: true,
    data: events,
    error: null,
  } satisfies ApiResponse);
});

// Interview agent
simulation.post("/:simulationId/interview", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const body = await c.req.json();
  const interviewSchema = z.object({
    agent_id: z.string(),
    question: z.string().min(1),
  });
  const input = interviewSchema.parse(body);

  const simService = getSimulationService();
  await simService.forwardCommand(simulationId, {
    type: "interview_agent",
    agent_id: input.agent_id,
    question: input.question,
  });

  return c.json({
    success: true,
    data: { sent: true },
    error: null,
  } satisfies ApiResponse);
});

// Fork scenario
simulation.post("/:simulationId/fork", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const body = await c.req.json();
  const forkSchema = z.object({
    branch_label: z.string().min(1),
    override_vars: z.record(z.unknown()),
  });
  const input = forkSchema.parse(body);

  const simService = getSimulationService();
  await simService.forkScenario(
    simulationId,
    input.branch_label,
    input.override_vars
  );

  return c.json({
    success: true,
    data: { forked: true },
    error: null,
  } satisfies ApiResponse);
});

// Save checkpoint
simulation.post("/:simulationId/checkpoint", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const simService = getSimulationService();
  await simService.saveCheckpoint(simulationId);

  return c.json({
    success: true,
    data: { saved: true },
    error: null,
  } satisfies ApiResponse);
});

// Inject manual action
simulation.post("/:simulationId/manual-action", async (c) => {
  const auth = c.get("auth") as AuthContext;
  const simulationId = c.req.param("simulationId");

  const sim = await getSimulationForOwner(simulationId, auth.userId);
  if (!sim) throw new HTTPException(404, { message: "Simulation not found" });

  const body = await c.req.json();
  const actionSchema = z.object({
    action: z.record(z.unknown()),
  });
  const input = actionSchema.parse(body);

  const simService = getSimulationService();
  await simService.injectManualAction(simulationId, input.action);

  return c.json({
    success: true,
    data: { injected: true },
    error: null,
  } satisfies ApiResponse);
});

export { simulation };
