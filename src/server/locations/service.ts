import "server-only";
import { AppError } from "@/lib/errors";
import type { LocationInput } from "@/lib/validation/admin";
import { writeAudit } from "@/server/audit";
import { assertWithinLimit } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export async function listLocations(ctx: TenantContext) {
  const [locations, stock] = await Promise.all([
    db.stockLocation.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { name: "asc" }],
      include: { parent: { select: { name: true } } },
    }),
    db.inventoryBalance.groupBy({
      by: ["locationId"],
      where: { businessId: ctx.businessId, quantity: { not: 0 } },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
  ]);
  const byLoc = new Map(stock.map((s) => [s.locationId, { products: s._count._all, units: Number(s._sum.quantity ?? 0) }]));
  return locations.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    type: l.type,
    parentId: l.parentId,
    parentName: l.parent?.name ?? null,
    isDefault: l.isDefault,
    isActive: l.isActive,
    products: byLoc.get(l.id)?.products ?? 0,
    units: byLoc.get(l.id)?.units ?? 0,
  }));
}

export async function saveLocation(ctx: TenantContext, input: LocationInput) {
  if (input.parentId) {
    if (input.parentId === input.id) throw new AppError("VALIDATION", undefined, { fieldErrors: { parentId: ["A location can't be inside itself"] } });
    const parent = await db.stockLocation.findFirst({ where: { id: input.parentId, businessId: ctx.businessId } });
    if (!parent) throw new AppError("VALIDATION", undefined, { fieldErrors: { parentId: ["Choose a valid location"] } });
  }
  const dup = await db.stockLocation.findFirst({
    where: { businessId: ctx.businessId, name: { equals: input.name, mode: "insensitive" }, parentId: input.parentId ?? null, NOT: input.id ? { id: input.id } : undefined },
  });
  if (dup) throw new AppError("DUPLICATE", "A location with this name already exists here.", { fieldErrors: { name: ["Already exists"] } });

  const data = { name: input.name, code: input.code ?? null, type: input.type, parentId: input.parentId ?? null };
  return db.$transaction(async (tx) => {
    if (input.id) {
      const updated = await tx.stockLocation.updateMany({ where: { id: input.id, businessId: ctx.businessId }, data });
      if (!updated.count) throw new AppError("NOT_FOUND", "Location not found.");
      await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "location.updated", entityType: "StockLocation", entityId: input.id, metadata: data });
      return { id: input.id };
    }
    await assertWithinLimit(ctx, "locations");
    const created = await tx.stockLocation.create({ data: { ...data, businessId: ctx.businessId } });
    await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "location.created", entityType: "StockLocation", entityId: created.id, metadata: data });
    return { id: created.id };
  });
}

/** Makes a location the default for receiving / stock out. */
export async function setDefaultLocation(ctx: TenantContext, id: string) {
  await db.$transaction(async (tx) => {
    const loc = await tx.stockLocation.findFirst({ where: { id, businessId: ctx.businessId, isActive: true } });
    if (!loc) throw new AppError("NOT_FOUND", "Location not found.");
    await tx.stockLocation.updateMany({ where: { businessId: ctx.businessId, isDefault: true }, data: { isDefault: false } });
    await tx.stockLocation.update({ where: { id }, data: { isDefault: true } });
    await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "location.default_changed", entityType: "StockLocation", entityId: id });
  });
}

/** Deactivates a location; only allowed when it holds no stock and isn't the default. */
export async function setLocationActive(ctx: TenantContext, id: string, active: boolean) {
  await db.$transaction(async (tx) => {
    const loc = await tx.stockLocation.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!loc) throw new AppError("NOT_FOUND", "Location not found.");
    if (!active) {
      if (loc.isDefault) throw new AppError("VALIDATION", "Choose another default location before turning this one off.");
      const stocked = await tx.inventoryBalance.count({ where: { locationId: id, quantity: { not: 0 } } });
      if (stocked) throw new AppError("VALIDATION", `This location still has stock for ${stocked} product(s). Move or adjust it first.`);
    }
    await tx.stockLocation.update({ where: { id }, data: { isActive: active } });
    await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: active ? "location.activated" : "location.deactivated", entityType: "StockLocation", entityId: id });
  });
}
