import "server-only";
import { AppError } from "@/lib/errors";
import { roleCan, type Permission } from "@/lib/permissions";
import type { TenantContext } from "@/server/tenancy/context";

export function can(ctx: TenantContext, permission: Permission): boolean {
  return roleCan(ctx.role, permission);
}

/** Throws FORBIDDEN unless the current member's role grants `permission`. */
export function assertCan(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx, permission)) throw new AppError("FORBIDDEN");
}
