import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DbOrTx } from "@/server/db";

/** Known audit actions. Free-form strings are allowed so new modules can add more. */
export type AuditAction =
  | "business.created"
  | "business.updated"
  | "user.created"
  | "user.login"
  | "user.logout"
  | "user.role_changed"
  | "user.deactivated"
  | "user.reactivated"
  | "product.created"
  | "product.updated"
  | "product.archived"
  | "product.restored"
  | "product.imported"
  | "barcode.assigned"
  | "category.created"
  | "category.updated"
  | "category.deleted"
  | "brand.created"
  | "supplier.created"
  | "supplier.updated"
  | "location.created"
  | "location.updated"
  | "stock.received"
  | "stock.removed"
  | "stock.adjusted"
  | (string & {});

export type AuditEntry = {
  businessId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

/**
 * Append an audit record. Pass the transaction client when auditing a
 * mutation so the audit row commits (or rolls back) with the change.
 * There is intentionally no update/delete function in this module.
 */
export async function writeAudit(client: DbOrTx, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      businessId: entry.businessId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
      ip: entry.ip ?? null,
    },
  });
}
