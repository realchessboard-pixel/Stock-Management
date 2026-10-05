import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, startOfBusinessDay } from "@/lib/time";
import type { MovementFilter } from "@/lib/validation/reports";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export const MOVEMENT_PAGE_SIZE = 50;

export function movementWhere(ctx: TenantContext, f: Omit<MovementFilter, "page">): Prisma.StockMovementWhereInput {
  const q = f.q?.trim();
  return {
    businessId: ctx.businessId,
    ...(f.productId ? { productId: f.productId } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.direction ? { direction: f.direction } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.locationId ? { locationId: f.locationId } : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: startOfBusinessDay(f.from) } : {}),
            ...(f.to ? { lt: startOfBusinessDay(addDays(f.to, 1)) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          product: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcodes: { some: { code: { contains: q } } } },
            ],
          },
        }
      : {}),
  };
}

const movementSelect = {
  id: true,
  type: true,
  direction: true,
  quantity: true,
  previousBalance: true,
  newBalance: true,
  unitCost: true,
  unitPrice: true,
  reason: true,
  referenceType: true,
  referenceId: true,
  createdAt: true,
  product: { select: { id: true, name: true, sku: true, unit: true } },
  location: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.StockMovementSelect;

/** Paginated ledger, newest first. Used by product ledger and the Movements page. */
export async function listMovements(ctx: TenantContext, f: MovementFilter) {
  const where = movementWhere(ctx, f);
  const [rows, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * MOVEMENT_PAGE_SIZE,
      take: MOVEMENT_PAGE_SIZE,
      select: movementSelect,
    }),
    db.stockMovement.count({ where }),
  ]);
  return {
    total,
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / MOVEMENT_PAGE_SIZE)),
    rows: rows.map((r) => ({
      ...r,
      quantity: r.quantity.toString(),
      previousBalance: r.previousBalance.toString(),
      newBalance: r.newBalance.toString(),
      unitCost: r.unitCost?.toString() ?? null,
      unitPrice: r.unitPrice?.toString() ?? null,
    })),
  };
}
export type MovementRow = Awaited<ReturnType<typeof listMovements>>["rows"][number];

/** Streams movements in batches (oldest first) for CSV export, capped for safety. */
export async function* iterateMovements(ctx: TenantContext, f: Omit<MovementFilter, "page">, max = 100_000) {
  const where = movementWhere(ctx, f);
  let cursor: string | undefined;
  let sent = 0;
  while (sent < max) {
    const batch = await db.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(1000, max - sent),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: movementSelect,
    });
    if (batch.length === 0) return;
    for (const row of batch) yield row;
    sent += batch.length;
    cursor = batch[batch.length - 1].id;
  }
}

/** Filter options (people and locations) for the ledger UI. */
export async function movementFilterOptions(ctx: TenantContext) {
  const [members, locations] = await Promise.all([
    db.membership.findMany({ where: { businessId: ctx.businessId }, select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.stockLocation.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { users: members.map((m) => m.user), locations };
}
