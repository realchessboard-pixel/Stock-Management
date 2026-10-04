import "server-only";
import { writeAudit } from "@/server/audit";
import { db, type Tx } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export async function listBrands(ctx: TenantContext) {
  return db.brand.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Finds a brand by name (case-insensitive) or creates it. Brands are typed freely on the product form. */
export async function resolveBrandId(tx: Tx, ctx: TenantContext, name: string | undefined): Promise<string | null> {
  const clean = name?.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const existing = await tx.brand.findFirst({
    where: { businessId: ctx.businessId, name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.brand.upsert({
    where: { businessId_name: { businessId: ctx.businessId, name: clean } },
    update: {},
    create: { businessId: ctx.businessId, name: clean },
  });
  await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "brand.created", entityType: "Brand", entityId: created.id, metadata: { name: clean } });
  return created.id;
}
