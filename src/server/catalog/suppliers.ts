import "server-only";
import { AppError } from "@/lib/errors";
import type { SupplierInput } from "@/lib/validation/catalog";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

const PAGE_SIZE = 30;

export async function listSuppliers(ctx: TenantContext, opts: { q?: string; page?: number; includeInactive?: boolean } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = {
    businessId: ctx.businessId,
    ...(opts.includeInactive ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { gstin: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
    db.supplier.count({ where }),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Minimal list for dropdowns. */
export async function supplierOptions(ctx: TenantContext) {
  return db.supplier.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, company: true },
    take: 500,
  });
}

export async function getSupplier(ctx: TenantContext, id: string) {
  const supplier = await db.supplier.findFirst({
    where: { id, businessId: ctx.businessId },
    include: {
      products: { where: { archivedAt: null }, select: { id: true, name: true, sku: true }, orderBy: { name: "asc" }, take: 50 },
    },
  });
  if (!supplier) throw new AppError("NOT_FOUND", "Supplier not found.");
  return supplier;
}

export async function saveSupplier(ctx: TenantContext, input: SupplierInput) {
  const data = {
    name: input.name,
    company: input.company ?? null,
    phone: input.phone ?? null,
    email: input.email?.toLowerCase() ?? null,
    address: input.address ?? null,
    gstin: input.gstin ?? null,
    notes: input.notes ?? null,
  };
  return db.$transaction(async (tx) => {
    if (input.id) {
      const updated = await tx.supplier.updateMany({
        where: { id: input.id, businessId: ctx.businessId },
        data: { ...data, ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
      });
      if (updated.count === 0) throw new AppError("NOT_FOUND", "Supplier not found.");
      await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "supplier.updated", entityType: "Supplier", entityId: input.id, metadata: data });
      return { id: input.id };
    }
    const created = await tx.supplier.create({ data: { ...data, businessId: ctx.businessId } });
    await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "supplier.created", entityType: "Supplier", entityId: created.id, metadata: { name: data.name } });
    return { id: created.id };
  });
}
