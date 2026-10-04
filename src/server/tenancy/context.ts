import "server-only";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import type { RoleName } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";

/**
 * The ONLY source of tenant identity. `businessId` always comes from the
 * server-side session — never from form data, params or headers. Every
 * service function takes this context and scopes queries with it.
 */
export type TenantContext = {
  businessId: string;
  userId: string;
  role: RoleName;
  sessionId: string;
  userName: string;
  businessName: string;
  allowNegativeStock: boolean;
};

export async function getTenantContext(): Promise<TenantContext | null> {
  const s = await getSession();
  if (!s) return null;
  return {
    businessId: s.business.id,
    userId: s.user.id,
    role: s.role,
    sessionId: s.sessionId,
    userName: s.user.name,
    businessName: s.business.name,
    allowNegativeStock: s.business.allowNegativeStock,
  };
}

/** For Server Components/pages: redirects to /login when signed out. */
export async function requirePageContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For Server Actions / Route Handlers: throws UNAUTHENTICATED when signed out. */
export async function requireContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED");
  return ctx;
}
