import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verifyAccessToken } from "../services/authService";

export interface AuthContext { userId: string; email: string; role: string; }

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  const token = header.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set("auth", { userId: payload.sub, email: payload.email, role: payload.role } satisfies AuthContext);
    await next();
  } catch { throw new HTTPException(401, { message: "Invalid or expired token" }); }
}
