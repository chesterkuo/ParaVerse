import { createHash } from "crypto";
import { getRedis } from "../middleware/rateLimit";
import { logger } from "../utils/logger";

const CACHE_PREFIX = "llm:cache:";
const DEFAULT_TTL = 1800; // 30 minutes

export function buildCacheKey(
  model: string,
  messages: unknown[],
  params: Record<string, unknown>
): string {
  const payload = JSON.stringify({ model, messages, params });
  const hash = createHash("sha256").update(payload).digest("hex");
  return `${CACHE_PREFIX}${hash}`;
}

export async function getCached(key: string): Promise<string | null> {
  try {
    const redis = getRedis();
    return await redis.get(key);
  } catch (err) {
    logger.warn({ err, key }, "LLM cache read error, failing open");
    return null;
  }
}

export async function setCached(
  key: string,
  value: string,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(key, value, "EX", ttl);
  } catch (err) {
    logger.warn({ err, key }, "LLM cache write error, failing open");
  }
}

// --- Simulation Event Cache ---
const EVENT_CACHE_TTL = 3600; // 1 hour

export async function getCachedEvents(simId: string, cursor: string): Promise<string | null> {
  try {
    return await getRedis().get(`sim:${simId}:events:${cursor}`);
  } catch { return null; }
}

export async function setCachedEvents(simId: string, cursor: string, data: string): Promise<void> {
  try {
    await getRedis().set(`sim:${simId}:events:${cursor}`, data, "EX", EVENT_CACHE_TTL);
  } catch { /* fail-open */ }
}

// --- Graph Neighbor Cache ---
const GRAPH_CACHE_TTL = 86400; // 24 hours

export async function getCachedGraphNeighbors(projectId: string, nodeId: string, depth: number): Promise<string | null> {
  try {
    return await getRedis().get(`graph:${projectId}:neighbors:${nodeId}:${depth}`);
  } catch { return null; }
}

export async function setCachedGraphNeighbors(projectId: string, nodeId: string, depth: number, data: string): Promise<void> {
  try {
    await getRedis().set(`graph:${projectId}:neighbors:${nodeId}:${depth}`, data, "EX", GRAPH_CACHE_TTL);
  } catch { /* fail-open */ }
}

// --- Agent State Cache ---
const AGENT_CACHE_TTL = 7200; // 2 hours

export async function getCachedAgentState(simId: string, agentId: string): Promise<string | null> {
  try {
    return await getRedis().get(`agents:${simId}:${agentId}:state`);
  } catch { return null; }
}

export async function setCachedAgentState(simId: string, agentId: string, data: string): Promise<void> {
  try {
    await getRedis().set(`agents:${simId}:${agentId}:state`, data, "EX", AGENT_CACHE_TTL);
  } catch { /* fail-open */ }
}

// --- Cache Invalidation ---
export async function invalidateSimCache(simId: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`sim:${simId}:*`);
    const agentKeys = await redis.keys(`agents:${simId}:*`);
    const allKeys = [...keys, ...agentKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch { /* fail-open */ }
}

export async function invalidateGraphCache(projectId: string): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`graph:${projectId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch { /* fail-open */ }
}
