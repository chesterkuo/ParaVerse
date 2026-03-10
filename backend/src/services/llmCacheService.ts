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
