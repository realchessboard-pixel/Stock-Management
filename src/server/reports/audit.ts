import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, startOfBusinessDay } from "@/lib/time";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilter = { action?: string; userId?: string; entityType?: string; from?: string; to?: string; page: number };

/** Read-only view of the audit trail (there is no edit/delete path). */
export async function listAuditLogs(ctx: TenantContext, f: AuditFilter) {
  const where: Prisma.AuditLogWhereInput = {
    businessId: ctx.businessId,
    ...(f.action ? { action: { startsWith: f.action } } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: startOfBusinessDay(f.from) } : {}), ...(f.to ? { lt: startOfBusinessDay(addDays(f.to, 1)) } : {}) } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, page: f.page, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}
