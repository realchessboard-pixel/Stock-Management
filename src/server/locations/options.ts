import "server-only";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

/** Active locations for pickers, default first. */
export async function locationOptions(ctx: TenantContext) {
  return db.stockLocation.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
}
