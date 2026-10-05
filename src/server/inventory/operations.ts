import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { AdjustStockInput, ReceiveStockInput, StockOutInput } from "@/lib/validation/stock";
import { writeAudit } from "@/server/audit";
import { nextBusinessSeq } from "@/server/barcodes";
import type { Tx } from "@/server/db";
import { runIdempotent } from "@/server/idempotency";
import type { TenantContext } from "@/server/tenancy/context";
import { getDefaultLocationId, lockBalance, postMovements, type PostedMovement } from "./engine";

/**
 * Business operations built on the movement engine. Each one is a single
 * idempotent transaction: document + movement + balance + audit commit together.
 * Prices and quantities are re-derived/validated here; the client only
 * supplies inputs.
 */

export type StockResult = {
  movementId: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  previousBalance: string;
  newBalance: string;
  referenceId: string | null;
  documentNumber: number | null;
};

async function loadProduct(tx: Tx, ctx: TenantContext, productId: string) {
  const product = await tx.product.findFirst({
    where: { id: productId, businessId: ctx.businessId },
    select: { id: true, name: true, unit: true, sellingPrice: true, purchasePrice: true, archivedAt: true },
  });
  if (!product) throw new AppError("PRODUCT_NOT_FOUND");
  return product;
}

function toResult(m: PostedMovement, product: { name: string; unit: string }, ref: { id: string | null; number: number | null }): StockResult {
  return {
    movementId: m.id,
    productId: m.productId,
    productName: product.name,
    unit: product.unit,
    quantity: m.quantity,
    previousBalance: m.previousBalance,
    newBalance: m.newBalance,
    referenceId: ref.id,
    documentNumber: ref.number,
  };
}

/** RECEIVE STOCK: Purchase document + PURCHASE movement (+ optional cost price update). */
export async function receiveStock(ctx: TenantContext, input: ReceiveStockInput) {
  return runIdempotent<StockResult>(ctx.businessId, input.idempotencyKey, "stock.receive", async (tx) => {
    const product = await loadProduct(tx, ctx, input.productId);
    if (input.supplierId) {
      const s = await tx.supplier.findFirst({ where: { id: input.supplierId, businessId: ctx.businessId }, select: { id: true } });
      if (!s) throw new AppError("VALIDATION", undefined, { fieldErrors: { supplierId: ["Choose a valid supplier"] } });
    }
    const locationId = input.locationId ?? (await getDefaultLocationId(tx, ctx.businessId));
    const unitCost = new Prisma.Decimal(input.unitCost ?? product.purchasePrice);
    const qty = new Prisma.Decimal(input.quantity);
    const lineTotal = unitCost.times(qty).toDecimalPlaces(2);

    const number = await nextBusinessSeq(tx, ctx.businessId, "purchaseSeq");
    const purchase = await tx.purchase.create({
      data: {
        businessId: ctx.businessId,
        number,
        supplierId: input.supplierId ?? null,
        locationId,
        invoiceNo: input.invoiceNo ?? null,
        totalAmount: lineTotal,
        createdById: ctx.userId,
        items: { create: { productId: product.id, quantity: qty, unitCost, lineTotal } },
      },
      select: { id: true },
    });
    const [m] = await postMovements(
      tx,
      ctx,
      [{ productId: product.id, locationId, type: "PURCHASE", quantity: qty, unitCost }],
      { referenceType: "PURCHASE", referenceId: purchase.id },
    );

    const costChanged = input.unitCost !== undefined && !unitCost.equals(product.purchasePrice);
    if (input.updateCost && costChanged) {
      await tx.product.update({ where: { id: product.id }, data: { purchasePrice: unitCost } });
    }
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "stock.received",
      entityType: "Product",
      entityId: product.id,
      metadata: {
        quantity: m.quantity,
        unitCost: unitCost.toString(),
        newBalance: m.newBalance,
        purchaseNumber: number,
        supplierId: input.supplierId ?? null,
        ...(input.updateCost && costChanged ? { purchasePriceUpdated: { from: product.purchasePrice.toString(), to: unitCost.toString() } } : {}),
      },
    });
    return toResult(m, product, { id: purchase.id, number });
  });
}

/** STOCK OUT: Sale document + SALE movement. Price always comes from the product master. */
export async function stockOut(ctx: TenantContext, input: StockOutInput) {
  return runIdempotent<StockResult>(ctx.businessId, input.idempotencyKey, "stock.out", async (tx) => {
    const product = await loadProduct(tx, ctx, input.productId);
    const locationId = input.locationId ?? (await getDefaultLocationId(tx, ctx.businessId));
    const qty = new Prisma.Decimal(input.quantity);
    const unitPrice = product.sellingPrice;
    const lineTotal = unitPrice.times(qty).toDecimalPlaces(2);

    // If stock is insufficient the whole transaction (including the sale number) rolls back.
    const number = await nextBusinessSeq(tx, ctx.businessId, "saleSeq");
    const sale = await tx.sale.create({
      data: {
        businessId: ctx.businessId,
        number,
        notes: input.note ?? null,
        totalAmount: lineTotal,
        createdById: ctx.userId,
        items: { create: { productId: product.id, quantity: qty, unitPrice, lineTotal } },
      },
      select: { id: true },
    });
    const [m] = await postMovements(
      tx,
      ctx,
      [{ productId: product.id, locationId, type: "SALE", quantity: qty, unitPrice, reason: input.note }],
      { referenceType: "SALE", referenceId: sale.id },
    );
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "stock.removed",
      entityType: "Product",
      entityId: product.id,
      metadata: { quantity: m.quantity, unitPrice: unitPrice.toString(), newBalance: m.newBalance, saleNumber: number },
    });
    return toResult(m, product, { id: sale.id, number });
  });
}

/** ADJUST STOCK: damage, loss, returns, corrections or a physical count. Reason is mandatory. */
export async function adjustStock(ctx: TenantContext, input: AdjustStockInput) {
  return runIdempotent<StockResult>(ctx.businessId, input.idempotencyKey, "stock.adjust", async (tx) => {
    const product = await loadProduct(tx, ctx, input.productId);
    const locationId = input.locationId ?? (await getDefaultLocationId(tx, ctx.businessId));

    let type = input.type;
    let quantity = input.quantity;
    if (input.mode === "count") {
      // Lock first so the difference is computed against a stable balance.
      const current = await lockBalance(tx, ctx.businessId, product.id, locationId);
      const diff = new Prisma.Decimal(input.countedQuantity!).minus(current);
      if (diff.isZero()) throw new AppError("VALIDATION", "Stock already matches your count. Nothing to change.", { fieldErrors: { countedQuantity: ["Same as current stock"] } });
      type = diff.gt(0) ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
      quantity = diff.abs().toString();
    }

    const [m] = await postMovements(
      tx,
      ctx,
      [{ productId: product.id, locationId, type: type!, quantity: quantity!, reason: input.reason, unitCost: product.purchasePrice }],
      { referenceType: "ADJUSTMENT" },
    );
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "stock.adjusted",
      entityType: "Product",
      entityId: product.id,
      metadata: { type: m.type, mode: input.mode, quantity: m.quantity, previousBalance: m.previousBalance, newBalance: m.newBalance, reason: input.reason },
    });
    return toResult(m, product, { id: null, number: null });
  });
}

/** OPENING STOCK, posted inside product creation (same transaction). */
export async function postOpeningStock(tx: Tx, ctx: TenantContext, productId: string, quantity: string, locationId?: string) {
  if (new Prisma.Decimal(quantity).lte(0)) return null;
  const product = await tx.product.findFirstOrThrow({ where: { id: productId, businessId: ctx.businessId }, select: { purchasePrice: true, name: true } });
  const [m] = await postMovements(
    tx,
    ctx,
    [{ productId, locationId, type: "OPENING", quantity, unitCost: product.purchasePrice, reason: "Opening stock" }],
    { referenceType: "OPENING" },
  );
  await writeAudit(tx, {
    businessId: ctx.businessId,
    userId: ctx.userId,
    action: "stock.opening",
    entityType: "Product",
    entityId: productId,
    metadata: { quantity: m.quantity },
  });
  return m;
}
