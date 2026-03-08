import { query } from "../client";

export interface UserRow { id: string; email: string; password_hash: string; name: string; role: string; quota: Record<string, unknown>; created_at: string; }

export async function createUser(email: string, passwordHash: string, name: string) {
  const result = await query<UserRow>("INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, quota, created_at", [email, passwordHash, name]);
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const result = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

export async function findUserById(id: string) {
  const result = await query<UserRow>("SELECT id, email, name, role, quota, created_at FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}
