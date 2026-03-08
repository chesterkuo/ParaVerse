import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { logger } from "../utils/logger";
import type { ApiResponse } from "@shared/types/api";

export async function errorHandler(c: Context, next: Next) {
  try { await next(); } catch (err) {
    if (err instanceof HTTPException) {
      return c.json({ success: false, data: null, error: err.message } satisfies ApiResponse, err.status);
    }
    if (err instanceof ZodError) {
      return c.json({ success: false, data: null, error: err.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") } satisfies ApiResponse, 400);
    }
    logger.error({ err }, "Unhandled error");
    return c.json({ success: false, data: null, error: "Internal server error" } satisfies ApiResponse, 500);
  }
}
