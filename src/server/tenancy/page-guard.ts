import "server-only";
import type { Permission } from "@/lib/permissions";
import { can } from "@/server/permissions";
import { requirePageContext, type TenantContext } from "./context";

/** For pages: returns the context plus whether the member holds `permission`. */
export async function pageAccess(permission?: Permission): Promise<{ ctx: TenantContext; allowed: boolean }> {
  const ctx = await requirePageContext();
  return { ctx, allowed: permission ? can(ctx, permission) : true };
}
