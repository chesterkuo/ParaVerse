import { query } from "../client";

export interface LtiPlatformRow {
  id: string;
  issuer: string;
  client_id: string;
  auth_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  deployment_id: string | null;
  institution_name: string | null;
  created_at: string;
}

export interface LtiUserMappingRow {
  id: string;
  lti_platform_id: string;
  lti_user_id: string;
  paraverse_user_id: string;
  created_at: string;
}

export async function getLtiPlatformByIssuer(issuer: string) {
  const result = await query<LtiPlatformRow>(
    "SELECT * FROM lti_platforms WHERE issuer = $1",
    [issuer]
  );
  return result.rows[0] || null;
}

export async function getLtiUserMapping(platformId: string, ltiUserId: string) {
  const result = await query<LtiUserMappingRow>(
    "SELECT * FROM lti_user_mappings WHERE lti_platform_id = $1 AND lti_user_id = $2",
    [platformId, ltiUserId]
  );
  return result.rows[0] || null;
}

export async function createLtiUserMapping(platformId: string, ltiUserId: string, paraverseUserId: string) {
  const result = await query<LtiUserMappingRow>(
    "INSERT INTO lti_user_mappings (lti_platform_id, lti_user_id, paraverse_user_id) VALUES ($1, $2, $3) RETURNING *",
    [platformId, ltiUserId, paraverseUserId]
  );
  return result.rows[0];
}
