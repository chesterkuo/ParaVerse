import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthContext } from "./auth";
import { query } from "../db/client";
import { getApprovalByUserId } from "../db/queries/organizationApprovals";
import { logger } from "../utils/logger";

export const RESTRICTED_SCENARIOS = ["war_game"] as const;

export function scenarioAccessCheck(source: "body" | "project") {
  return async (c: Context, next: Next) => {
    const auth = c.get("auth") as AuthContext;

    let scenarioType: string | undefined;

    if (source === "body") {
      const body = await c.req.json();
      c.set("parsedBody", body);
      scenarioType = body.scenario_type;
    } else if (source === "project") {
      const simulationId = c.req.param("simulationId");
      if (simulationId) {
        const result = await query<{ scenario_type: string }>(
          `SELECT p.scenario_type
             FROM simulations s
             JOIN projects p ON p.id = s.project_id
            WHERE s.id = $1`,
          [simulationId]
        );
        scenarioType = result.rows[0]?.scenario_type;
      }
    }

    if (!scenarioType || !RESTRICTED_SCENARIOS.includes(scenarioType as any)) {
      await next();
      return;
    }

    // Restricted scenario — verify institutional access
    const result = await query<{ institution_verified: boolean }>(
      `SELECT institution_verified FROM users WHERE id = $1`,
      [auth.userId]
    );

    const user = result.rows[0];
    if (!user || !user.institution_verified) {
      // Fallback: check organization_approvals for an approved record
      const approval = await getApprovalByUserId(auth.userId);
      if (!approval || approval.status !== "approved") {
        logger.warn(
          { userId: auth.userId, scenarioType },
          "Blocked access to restricted scenario: institutional verification required"
        );
        throw new HTTPException(403, {
          message:
            "Access denied: institutional verification is required to use war_game scenarios. Please contact your administrator.",
        });
      }
    }

    await next();
  };
}
