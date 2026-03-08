import { Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { hashPassword, verifyPassword, generateTokens, verifyRefreshToken } from "../services/authService";
import { createUser, findUserByEmail, findUserById } from "../db/queries/users";
import type { ApiResponse } from "../../../shared/types/api";

const auth = new Hono();

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1).max(100) });
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
const refreshSchema = z.object({ refresh_token: z.string() });

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const input = registerSchema.parse(body);
  const existing = await findUserByEmail(input.email);
  if (existing) throw new HTTPException(409, { message: "Email already registered" });
  const passwordHash = await hashPassword(input.password);
  const user = await createUser(input.email, passwordHash, input.name);
  const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });
  return c.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens }, error: null } satisfies ApiResponse, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const input = loginSchema.parse(body);
  const user = await findUserByEmail(input.email);
  if (!user) throw new HTTPException(401, { message: "Invalid email or password" });
  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) throw new HTTPException(401, { message: "Invalid email or password" });
  const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });
  return c.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens }, error: null } satisfies ApiResponse);
});

auth.post("/refresh", async (c) => {
  const body = await c.req.json();
  const input = refreshSchema.parse(body);
  try {
    const payload = await verifyRefreshToken(input.refresh_token);
    const user = await findUserById(payload.sub);
    if (!user) throw new HTTPException(401, { message: "User not found" });
    const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });
    return c.json({ success: true, data: tokens, error: null } satisfies ApiResponse);
  } catch { throw new HTTPException(401, { message: "Invalid refresh token" }); }
});

export { auth };
