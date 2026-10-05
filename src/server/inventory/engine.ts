import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { MovementType, ReferenceType } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";
import { formatQty } from "@/lib/format";
import { MOVEMENT_DIRECTION } from "@/lib/movements";
import type { Tx } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

/**
 * ─────────────────────────── STOCK MOVEMENT ENGINE ───────────────────────────
 *
 * The ONLY code allowed to change inventory. Every change:
 *   1. locks the (product, location) balance row with SELECT … FOR UPDATE,
 *   2. computes the new balance on the server from the locked DB value,
 *   3. refuses to go below zero unless the business enabled negative stock,
 *   4. writes an append-only StockMovement (with previous/new balance)
 *      and updates InventoryBalance — in the caller's transaction.
 *
 * Because the movement insert and the balance update share one transaction,
 * it is impossible to have one without the other. Concurrent operations on
 * the same product serialise on the row lock, so balances never race.
 */

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export type MovementLine = {
  productId: string;
  /** Defaults to the business's default location. */
  locationId?: string;
  type: MovementType;
  /** Positive decimal string/number. Direction comes from `type`. */
  quantity: string | number | Decimal;
  unitCost?: string | Decimal | null;
  unitPrice?: string | Decimal | null;
  reason?: string | null;
};

export type PostOptions = {
  referenceType?: ReferenceType;
  referenceId?: string;
};

export type PostedMovement = {
  id: string;
  productId: string;
  locationId: string;
  type: MovementType;
  direction: "IN" | "OUT";
  quantity: string;
  previousBalance: string;
  newBalance: string;
};

export async function getDefaultLocationId(tx: Tx, businessId: string): Promise<string> {
  const loc = await tx.stockLocation.findFirst({
    where: { businessId, isDefault: true },
    select: { id: true },
  });
  if (!loc) throw new AppError("INTERNAL");
  return loc.id;
}

/**
 * Locks (creating if needed) the balance row and returns its current quantity.
 * Exposed so callers can read a locked balance before deciding what to post
 * (e.g. a physical stock count).
 */
export async function lockBalance(tx: Tx, businessId: string, productId: string, locationId: string): Promise<Decimal> {
  await tx.$executeRaw`
    INSERT INTO "InventoryBalance" ("id", "businessId", "productId", "locationId", "quantity", "updatedAt")
    VALUES (${`bal_${productId}_${locationId}`}, ${businessId}, ${productId}, ${locationId}, 0, now())
    ON CONFLICT ("productId", "locationId") DO NOTHING`;
  const rows = await tx.$queryRaw<{ quantity: Decimal; businessId: string }[]>`
    SELECT "quantity", "businessId" FROM "InventoryBalance"
    WHERE "productId" = ${productId} AND "locationId" = ${locationId}
    FOR UPDATE`;
  const row = rows[0];
  if (!row || row.businessId !== businessId) throw new AppError("PRODUCT_NOT_FOUND");
  return new D(row.quantity);
}

function toQty(v: MovementLine["quantity"]): Decimal {
  let q: Decimal;
  try {
    q = new D(v.toString());
  } catch {
    throw new AppError("INVALID_QUANTITY");
  }
  if (!q.isFinite() || q.lte(0) || q.decimalPlaces() > 3 || q.gt(9_999_999)) throw new AppError("INVALID_QUANTITY");
  return q;
}

/**
 * Posts one or more stock movements inside `tx`.
 * Lines are locked in a stable (product, location) order to avoid deadlocks
 * between concurrent multi-line operations.
 */
export async function postMovements(tx: Tx, ctx: TenantContext, lines: MovementLine[], opts: PostOptions = {}): Promise<PostedMovement[]> {
  if (lines.length === 0) return [];

  // Re-read the setting inside the transaction; never trust a stale session copy.
  const business = await tx.business.findUniqueOrThrow({
    where: { id: ctx.businessId },
    select: { allowNegativeStock: true },
  });
  const defaultLocationId = lines.some((l) => !l.locationId) ? await getDefaultLocationId(tx, ctx.businessId) : "";

  const resolved = lines.map((l, index) => ({ ...l, index, locationId: l.locationId ?? defaultLocationId, qty: toQty(l.quantity) }));

  // Validate products and locations belong to this tenant (one query each).
  const productIds = [...new Set(resolved.map((l) => l.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, businessId: ctx.businessId },
    select: { id: true, name: true, unit: true, archivedAt: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  const locationIds = [...new Set(resolved.map((l) => l.locationId))];
  const locations = await tx.stockLocation.findMany({
    where: { id: { in: locationIds }, businessId: ctx.businessId, isActive: true },
    select: { id: true },
  });
  if (locations.length !== locationIds.length) throw new AppError("NOT_FOUND", "Stock location not found.");

  for (const l of resolved) {
    const p = productById.get(l.productId);
    if (!p) throw new AppError("PRODUCT_NOT_FOUND");
    if (p.archivedAt && l.type !== "OPENING") throw new AppError("VALIDATION", `"${p.name}" is archived. Restore it before moving stock.`);
  }

  const order = [...resolved].sort((a, b) =>
    a.productId === b.productId ? a.locationId.localeCompare(b.locationId) : a.productId.localeCompare(b.productId),
  );

  const posted: { index: number; movement: PostedMovement }[] = [];
  const running = new Map<string, Decimal>();
  for (const l of order) {
    const key = `${l.productId}:${l.locationId}`;
    const previous = running.get(key) ?? (await lockBalance(tx, ctx.businessId, l.productId, l.locationId));
    const direction = MOVEMENT_DIRECTION[l.type];
    const next = direction === "IN" ? previous.plus(l.qty) : previous.minus(l.qty);

    if (next.lt(0) && !business.allowNegativeStock) {
      const p = productById.get(l.productId)!;
      throw new AppError("INSUFFICIENT_STOCK", `Not enough stock of "${p.name}". Available: ${formatQty(previous.toString())} ${p.unit}.`, {
        details: { productId: l.productId, available: previous.toString() },
        fieldErrors: { quantity: [`Only ${formatQty(previous.toString())} available`] },
      });
    }

    const movement = await tx.stockMovement.create({
      data: {
        businessId: ctx.businessId,
        productId: l.productId,
        locationId: l.locationId,
        type: l.type,
        direction,
        quantity: l.qty,
        previousBalance: previous,
        newBalance: next,
        unitCost: l.unitCost ?? null,
        unitPrice: l.unitPrice ?? null,
        reason: l.reason ?? null,
        referenceType: opts.referenceType ?? null,
        referenceId: opts.referenceId ?? null,
        userId: ctx.userId,
      },
      select: { id: true },
    });
    running.set(key, next);
    posted.push({
      index: l.index,
      movement: {
        id: movement.id,
        productId: l.productId,
        locationId: l.locationId,
        type: l.type,
        direction,
        quantity: l.qty.toString(),
        previousBalance: previous.toString(),
        newBalance: next.toString(),
      },
    });
  }

  // One balance write per touched row, with the final value.
  for (const [key, qty] of running) {
    const [productId, locationId] = key.split(":");
    await tx.inventoryBalance.update({
      where: { productId_locationId: { productId, locationId } },
      data: { quantity: qty },
    });
  }

  return posted.sort((a, b) => a.index - b.index).map((p) => p.movement);
}
