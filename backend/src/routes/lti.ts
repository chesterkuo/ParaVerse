import { Hono } from "hono";
import * as jose from "jose";
import { HTTPException } from "hono/http-exception";
import { generateTokens } from "../services/authService";
import { findUserByEmail, createUser } from "../db/queries/users";
import { getLtiPlatformByIssuer, getLtiUserMapping, createLtiUserMapping } from "../db/queries/lti";
import { query } from "../db/client";
import { logger } from "../utils/logger";

const lti = new Hono();

const FRONTEND_URL = process.env.CORS_ORIGIN || "http://localhost:3000";

lti.post("/launch", async (c) => {
  const body = await c.req.parseBody();
  const idToken = body["id_token"] as string;
  if (!idToken) throw new HTTPException(400, { message: "Missing id_token" });

  // Decode without verification first to get issuer
  const claims = jose.decodeJwt(idToken);
  const issuer = claims.iss;
  if (!issuer) throw new HTTPException(400, { message: "Missing issuer in id_token" });

  // Look up platform registration
  const platform = await getLtiPlatformByIssuer(issuer);
  if (!platform) throw new HTTPException(403, { message: "Unknown LTI platform" });

  // Verify JWT using platform's JWKS
  const jwks = jose.createRemoteJWKSet(new URL(platform.jwks_uri));
  try {
    await jose.jwtVerify(idToken, jwks, {
      issuer: platform.issuer,
      audience: platform.client_id,
    });
  } catch (err) {
    logger.warn({ err, issuer }, "LTI JWT verification failed");
    throw new HTTPException(401, { message: "Invalid LTI token" });
  }

  // Extract LTI claims
  const ltiUserId = claims.sub;
  const email = (claims as Record<string, unknown>).email as string | undefined;
  const name = (claims as Record<string, unknown>).name as string | undefined;

  if (!ltiUserId || !email) {
    throw new HTTPException(400, { message: "Missing required claims (sub, email)" });
  }

  // Find or create ParaVerse user
  let user = await findUserByEmail(email);
  if (!user) {
    user = await createUser(email, "", name || email.split("@")[0]);
  }

  // Create LTI user mapping if new
  const existingMapping = await getLtiUserMapping(platform.id, ltiUserId);
  if (!existingMapping) {
    await createLtiUserMapping(platform.id, ltiUserId, user.id);
  }

  // Mark user as verified institution
  await query(
    "UPDATE users SET institution_verified = true, institution_name = COALESCE(institution_name, $1), verified_at = COALESCE(verified_at, NOW()) WHERE id = $2",
    [platform.institution_name, user.id]
  );

  // Generate ParaVerse auth tokens
  const tokens = await generateTokens({ id: user.id, email: user.email, role: user.role });

  // Redirect to frontend callback
  const callbackUrl = new URL("/lti/callback", FRONTEND_URL);
  callbackUrl.searchParams.set("access_token", tokens.access_token);
  callbackUrl.searchParams.set("refresh_token", tokens.refresh_token);

  return c.redirect(callbackUrl.toString(), 302);
});

lti.get("/jwks", (c) => {
  return c.json({ keys: [] });
});

lti.get("/config", (c) => {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:5001";
  return c.json({
    title: "ParaVerse Simulation Platform",
    description: "Multi-agent simulation platform for policy analysis and training",
    oidc_initiation_url: `${baseUrl}/lti/launch`,
    target_link_uri: `${baseUrl}/lti/launch`,
    scopes: [
      "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
      "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
    ],
    extensions: [
      {
        platform: "canvas.instructure.com",
        privacy_level: "public",
        settings: {
          placements: [
            {
              placement: "course_navigation",
              message_type: "LtiResourceLinkRequest",
              target_link_uri: `${baseUrl}/lti/launch`,
            },
          ],
        },
      },
    ],
    public_jwk_url: `${baseUrl}/lti/jwks`,
    custom_fields: {},
  });
});

export { lti };
