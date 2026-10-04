import "server-only";
import { AppError } from "@/lib/errors";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

/**
 * Subscription entitlements, kept separate from inventory logic. Inventory
 * services call `assertWithinLimit` before creating limited resources;
 * billing (payments, plan changes) can be added later without touching them.
 * Limits are deliberately generous until billing exists.
 */
export type PlanName = "FREE" | "BASIC" | "PRO";

export const PLAN_LIMITS: Record<PlanName, { products: number; users: number; locations: number }> = {
  FREE: { products: 5000, users: 5, locations: 10 },
  BASIC: { products: 25000, users: 15, locations: 50 },
  PRO: { products: 250000, users: 100, locations: 500 },
};

export type LimitedResource = keyof (typeof PLAN_LIMITS)[PlanName];

export async function assertWithinLimit(ctx: TenantContext, resource: LimitedResource, adding = 1) {
  const business = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { plan: true } });
  const limit = PLAN_LIMITS[business.plan][resource];
  const where = { businessId: ctx.businessId };
  const current =
    resource === "products"
      ? await db.product.count({ where })
      : resource === "users"
        ? await db.membership.count({ where: { ...where, isActive: true } })
        : await db.stockLocation.count({ where });
  if (current + adding > limit) {
    throw new AppError("PLAN_LIMIT", `Your ${business.plan} plan allows up to ${limit} ${resource}.`);
  }
}
