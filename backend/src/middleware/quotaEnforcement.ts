import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthContext } from "./auth";
import { findUserById } from "../db/queries/users";
import { getMonthlyUsageCount } from "../db/queries/usage";
import { logger } from "../utils/logger";

const DEFAULT_QUOTA = { simulations_per_month: 2, max_agents: 50 };

const RESOURCE_TO_QUOTA_FIELD: Record<string, string> = {
  simulation: "simulations_per_month",
};

export function quotaCheck(resourceType: string) {
  return async (c: Context, next: Next) => {
    try {
      const auth = c.get("auth") as AuthContext;
      const user = await findUserById(auth.userId);
      if (!user) {
        throw new HTTPException(401, { message: "User not found" });
      }

      const quota = (user.quota ?? DEFAULT_QUOTA) as Record<string, number>;
      const quotaField = RESOURCE_TO_QUOTA_FIELD[resourceType];

      if (!quotaField || !(quotaField in quota)) {
        // No matching quota field — skip check
        await next();
        return;
      }

      const maxAllowed = quota[quotaField];
      const currentUsage = await getMonthlyUsageCount(auth.userId, resourceType);

      if (currentUsage >= maxAllowed) {
        throw new HTTPException(429, {
          message: `Quota exceeded: you have used ${currentUsage}/${maxAllowed} ${resourceType}s this month`,
        });
      }

      await next();
    } catch (err) {
      if (err instanceof HTTPException) {
        throw err;
      }
      // Fail-open: allow request but log the error
      logger.error({ err, resourceType }, "Quota check failed, allowing request");
      await next();
    }
  };
}
