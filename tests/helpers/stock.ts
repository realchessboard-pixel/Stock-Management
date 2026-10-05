import { randomUUID } from "node:crypto";
import { createProductSchema } from "@/lib/validation/catalog";
import { adjustStockSchema, receiveStockSchema, stockOutSchema } from "@/lib/validation/stock";
import { db } from "@/server/db";
import { adjustStock, receiveStock, stockOut } from "@/server/inventory/operations";
import { createProduct } from "@/server/products/service";
import type { TenantContext } from "@/server/tenancy/context";

export async function makeProduct(ctx: TenantContext, opening = "0", extra: Record<string, unknown> = {}) {
  const { id } = await createProduct(
    ctx,
    createProductSchema.parse({
      name: `Product ${randomUUID().slice(0, 6)}`,
      unit: "pcs",
      purchasePrice: "10",
      sellingPrice: "15",
      barcodeMode: "generate",
      openingQuantity: opening,
      idempotencyKey: randomUUID(),
      ...extra,
    }),
  );
  return id;
}

export const receive = (ctx: TenantContext, productId: string, quantity: string, extra: Record<string, unknown> = {}) =>
  receiveStock(ctx, receiveStockSchema.parse({ idempotencyKey: randomUUID(), productId, quantity, ...extra }));

export const sell = (ctx: TenantContext, productId: string, quantity: string, extra: Record<string, unknown> = {}) =>
  stockOut(ctx, stockOutSchema.parse({ idempotencyKey: randomUUID(), productId, quantity, ...extra }));

export const adjust = (ctx: TenantContext, productId: string, fields: Record<string, unknown>) =>
  adjustStock(ctx, adjustStockSchema.parse({ idempotencyKey: randomUUID(), productId, reason: "test", ...fields }));

export async function onHand(productId: string) {
  const rows = await db.inventoryBalance.findMany({ where: { productId } });
  return rows.reduce((s, r) => s + Number(r.quantity), 0);
}

/** Asserts ledger ⇔ balance consistency for every (product, location) of a business. */
export async function ledgerMatchesBalances(businessId: string) {
  const balances = await db.inventoryBalance.findMany({ where: { businessId } });
  for (const b of balances) {
    const movements = await db.stockMovement.findMany({
      where: { productId: b.productId, locationId: b.locationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let running = 0;
    for (const m of movements) {
      const prev = Number(m.previousBalance);
      if (Math.abs(prev - running) > 1e-9) return { ok: false as const, reason: `chain broken at ${m.id}: expected prev ${running}, got ${prev}` };
      running += (m.direction === "IN" ? 1 : -1) * Number(m.quantity);
      if (Math.abs(Number(m.newBalance) - running) > 1e-9) return { ok: false as const, reason: `newBalance mismatch at ${m.id}` };
    }
    if (Math.abs(running - Number(b.quantity)) > 1e-9) return { ok: false as const, reason: `balance ${b.quantity} != ledger ${running}` };
  }
  return { ok: true as const };
}
