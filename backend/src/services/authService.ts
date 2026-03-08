import * as argon2 from "argon2";
import * as jose from "jose";

const JWT_SECRET_KEY = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-32chars!");
const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "7d";

export interface TokenPayload { id: string; email: string; role: string; }

export async function hashPassword(password: string): Promise<string> { return argon2.hash(password); }

export async function verifyPassword(password: string, hash: string): Promise<boolean> { return argon2.verify(hash, password); }

export async function generateTokens(user: TokenPayload) {
  const secret = JWT_SECRET_KEY();
  const access_token = await new jose.SignJWT({ sub: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ACCESS_TOKEN_TTL).sign(secret);
  const refresh_token = await new jose.SignJWT({ sub: user.id, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(REFRESH_TOKEN_TTL).sign(secret);
  return { access_token, refresh_token };
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY());
  return payload as jose.JWTPayload & { sub: string; email: string; role: string };
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY());
  if (payload.type !== "refresh") throw new Error("Invalid refresh token");
  return payload as jose.JWTPayload & { sub: string; type: string };
}
