import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import Redis from "ioredis";
import { logger } from "../utils/logger";
import type { AuthContext } from "./auth";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      logger.warn({ err }, "Redis connection error (rate limiter)");
    });
  }
  return redis;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export function rateLimit(opts: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext | undefined;
    const identifier =
      auth?.userId ||
      c.req.header("x-forwarded-for") ||
      "anon";

    const key = `${opts.keyPrefix}:${identifier}`;

    try {
      const client = getRedis();
      const current = await client.incr(key);

      if (current === 1) {
        await client.pexpire(key, opts.windowMs);
      }

      if (current > opts.max) {
        throw new HTTPException(429, {
          message: "Too many requests, please try again later",
        });
      }
    } catch (err) {
      // If it's our own 429, rethrow it
      if (err instanceof HTTPException) {
        throw err;
      }

      // Fail open: if Redis is down, allow the request through
      logger.warn(
        { err, key },
        "Rate limiter Redis error, failing open"
      );
    }

    await next();
  };
}
