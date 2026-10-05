import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { receiveStockSchema, stockOutSchema } from "@/lib/validation/stock";
import { db } from "@/server/db";
import { postMovements } from "@/server/inventory/engine";
import { receiveStock, stockOut } from "@/server/inventory/operations";
import { setProductArchived } from "@/server/products/service";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";
import { adjust, ledgerMatchesBalances, makeProduct, onHand, receive, sell } from "../helpers/stock";

describe("stock movement engine", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("CRITICAL RULE: 100 → receive +20 → sale −10 → damage −2 = 108, and the ledger matches", async () => {
    const id = await makeProduct(ctx, "100");
    await receive(ctx, id, "20");
    await sell(ctx, id, "10");
    await adjust(ctx, id, { type: "DAMAGE", quantity: "2", reason: "Broken in transit" });

    expect(await onHand(id)).toBe(108);
    const ledger = await db.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((m) => [m.type, m.direction, Number(m.quantity), Number(m.previousBalance), Number(m.newBalance)])).toEqual([
      ["OPENING", "IN", 100, 0, 100],
      ["PURCHASE", "IN", 20, 100, 120],
      ["SALE", "OUT", 10, 120, 110],
      ["DAMAGE", "OUT", 2, 110, 108],
    ]);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
    expect(ledger.every((m) => m.userId === ctx.userId)).toBe(true);
  });

  it("spec example: opening 50, purchase 100, sale 10, damage 2 → 138", async () => {
    const id = await makeProduct(ctx, "50");
    await receive(ctx, id, "100");
    await sell(ctx, id, "10");
    await adjust(ctx, id, { type: "DAMAGE", quantity: "2" });
    expect(await onHand(id)).toBe(138);
  });

  it("prevents negative stock and leaves no trace of the failed attempt", async () => {
    const id = await makeProduct(ctx, "5");
    const before = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
    await expect(sell(ctx, id, "6")).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(adjust(ctx, id, { type: "LOSS", quantity: "5.001" })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await onHand(id)).toBe(5);
    expect(await db.stockMovement.count({ where: { productId: id } })).toBe(1);
    expect(await db.sale.count({ where: { businessId: ctx.businessId } })).toBe(0);
    const after = await db.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
    expect(after.saleSeq).toBe(before.saleSeq);
    await expect(sell(ctx, id, "5")).resolves.toBeTruthy();
    expect(await onHand(id)).toBe(0);
  });

  it("allows negative stock only when the business enables it", async () => {
    const id = await makeProduct(ctx, "1");
    await db.business.update({ where: { id: ctx.businessId }, data: { allowNegativeStock: true } });
    await sell(ctx, id, "3");
    expect(await onHand(id)).toBe(-2);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
  });

  it("supports decimal quantities (metres, kg) exactly", async () => {
    const id = await makeProduct(ctx, "10.5");
    await sell(ctx, id, "0.125");
    await sell(ctx, id, "0.125");
    await receive(ctx, id, "0.001");
    expect((await db.inventoryBalance.findFirstOrThrow({ where: { productId: id } })).quantity.toString()).toBe("10.251");
  });

  it("rejects zero, negative and over-precise quantities at validation", () => {
    for (const q of ["0", "-1", "1.0001", "abc", ""]) {
      expect(stockOutSchema.safeParse({ idempotencyKey: randomUUID(), productId: "cmabcdefghijklmnopqrstuv", quantity: q }).success).toBe(false);
    }
  });

  it("rolls back movement AND balance together when anything later in the transaction fails", async () => {
    const id = await makeProduct(ctx, "10");
    await expect(
      db.$transaction(async (tx) => {
        await postMovements(tx, ctx, [{ productId: id, type: "SALE", quantity: "3" }]);
        throw new Error("simulated crash after posting");
      }),
    ).rejects.toThrow("simulated crash");
    expect(await onHand(id)).toBe(10);
    expect(await db.stockMovement.count({ where: { productId: id } })).toBe(1);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
  });

  it("posts multi-line operations against a running balance (same product twice)", async () => {
    const id = await makeProduct(ctx, "10");
    const posted = await db.$transaction((tx) =>
      postMovements(tx, ctx, [
        { productId: id, type: "SALE", quantity: "4" },
        { productId: id, type: "CUSTOMER_RETURN", quantity: "1" },
      ]),
    );
    expect(posted.map((m) => [m.previousBalance, m.newBalance])).toEqual([
      ["10", "6"],
      ["6", "7"],
    ]);
    expect(await onHand(id)).toBe(7);
  });

  it("refuses to move stock of an archived product", async () => {
    const id = await makeProduct(ctx, "10");
    await setProductArchived(ctx, id, true);
    await expect(sell(ctx, id, "1")).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("concurrency and duplicate submission", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Busy Shop");
  });

  it("20 simultaneous stock-outs of 1 on a stock of 10: exactly 10 succeed, stock ends at 0, never negative", async () => {
    const id = await makeProduct(ctx, "10");
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => sell(ctx, id, "1")));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const insufficient = results.filter((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "INSUFFICIENT_STOCK").length;
    expect(ok).toBe(10);
    expect(insufficient).toBe(10);
    expect(await onHand(id)).toBe(0);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
  });

  it("mixed concurrent receives and stock-outs add up exactly", async () => {
    const id = await makeProduct(ctx, "100");
    await Promise.all([
      ...Array.from({ length: 10 }, () => receive(ctx, id, "3")),
      ...Array.from({ length: 10 }, () => sell(ctx, id, "2")),
    ]);
    expect(await onHand(id)).toBe(110);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
  });

  it("a double-tapped Receive (same key, sent twice concurrently) records stock once", async () => {
    const id = await makeProduct(ctx, "0");
    const input = receiveStockSchema.parse({ idempotencyKey: randomUUID(), productId: id, quantity: "20" });
    const [a, b] = await Promise.all([receiveStock(ctx, input), receiveStock(ctx, input)]);
    expect(a.result.movementId).toBe(b.result.movementId);
    expect(await onHand(id)).toBe(20);
    expect(await db.stockMovement.count({ where: { productId: id, type: "PURCHASE" } })).toBe(1);
    expect(await db.purchase.count({ where: { businessId: ctx.businessId } })).toBe(1);
  });

  it("a retried Stock Out after success returns the original result instead of removing stock again", async () => {
    const id = await makeProduct(ctx, "10");
    const input = stockOutSchema.parse({ idempotencyKey: randomUUID(), productId: id, quantity: "4" });
    const first = await stockOut(ctx, input);
    const retry = await stockOut(ctx, input);
    expect(retry.replayed).toBe(true);
    expect(retry.result).toEqual(first.result);
    expect(await onHand(id)).toBe(6);
  });

  it("a failed attempt does not burn the key: fixing the input and retrying works", async () => {
    const id = await makeProduct(ctx, "2");
    const key = randomUUID();
    await expect(stockOut(ctx, stockOutSchema.parse({ idempotencyKey: key, productId: id, quantity: "5" }))).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
    await expect(stockOut(ctx, stockOutSchema.parse({ idempotencyKey: key, productId: id, quantity: "2" }))).resolves.toBeTruthy();
    expect(await onHand(id)).toBe(0);
  });
});

describe("receive, stock out and adjust details", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("receive creates a numbered purchase with supplier and updates purchase price when asked", async () => {
    const supplier = await db.supplier.create({ data: { businessId: ctx.businessId, name: "Ravi Traders" } });
    const id = await makeProduct(ctx);
    const { result } = await receive(ctx, id, "12", { unitCost: "11.50", supplierId: supplier.id, invoiceNo: "INV-9", updateCost: "true" });
    expect(result).toMatchObject({ quantity: "12", previousBalance: "0", newBalance: "12", documentNumber: 1 });
    const purchase = await db.purchase.findFirstOrThrow({ where: { businessId: ctx.businessId }, include: { items: true } });
    expect(purchase).toMatchObject({ number: 1, supplierId: supplier.id, invoiceNo: "INV-9" });
    expect(purchase.totalAmount.toString()).toBe("138");
    expect(purchase.items[0].unitCost.toString()).toBe("11.5");
    expect((await db.product.findUniqueOrThrow({ where: { id } })).purchasePrice.toString()).toBe("11.5");
    const mv = await db.stockMovement.findFirstOrThrow({ where: { productId: id, type: "PURCHASE" } });
    expect(mv).toMatchObject({ referenceType: "PURCHASE", referenceId: purchase.id });
    expect(await db.auditLog.count({ where: { businessId: ctx.businessId, action: "stock.received" } })).toBe(1);
  });

  it("stock out uses the product's selling price from the database, not the client", async () => {
    const id = await makeProduct(ctx, "10");
    await sell(ctx, id, "2", { unitPrice: "0.01" });
    const sale = await db.sale.findFirstOrThrow({ where: { businessId: ctx.businessId }, include: { items: true } });
    expect(sale.items[0].unitPrice.toString()).toBe("15");
    expect(sale.totalAmount.toString()).toBe("30");
  });

  it("physical count posts the difference as an adjustment", async () => {
    const id = await makeProduct(ctx, "10");
    await adjust(ctx, id, { mode: "count", countedQuantity: "7", reason: "Monthly count" });
    await adjust(ctx, id, { mode: "count", countedQuantity: "9", reason: "Found 2 more" });
    expect(await onHand(id)).toBe(9);
    const types = (await db.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "asc" } })).map((m) => [m.type, Number(m.quantity)]);
    expect(types).toEqual([
      ["OPENING", 10],
      ["ADJUSTMENT_OUT", 3],
      ["ADJUSTMENT_IN", 2],
    ]);
    await expect(adjust(ctx, id, { mode: "count", countedQuantity: "9", reason: "Same" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("customer and supplier returns move stock in the right direction", async () => {
    const id = await makeProduct(ctx, "10");
    await adjust(ctx, id, { type: "CUSTOMER_RETURN", quantity: "1" });
    await adjust(ctx, id, { type: "SUPPLIER_RETURN", quantity: "4" });
    expect(await onHand(id)).toBe(7);
  });

  it("opening stock failure rolls back product creation", async () => {
    const other = await createTenant("Other");
    const foreignLoc = await db.stockLocation.findFirstOrThrow({ where: { businessId: other.businessId } });
    const before = await db.product.count({ where: { businessId: ctx.businessId } });
    await expect(makeProduct(ctx, "5", { openingLocationId: foreignLoc.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.product.count({ where: { businessId: ctx.businessId } })).toBe(before);
  });
});

describe("tenant isolation for stock operations", () => {
  beforeEach(resetDatabase);

  it("a user of business B cannot receive, remove or adjust business A's product", async () => {
    const a = await createTenant("A");
    const b = await createTenant("B");
    const id = await makeProduct(a, "10");
    await expect(receive(b, id, "5")).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(sell(b, id, "5")).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(adjust(b, id, { type: "LOSS", quantity: "1" })).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(db.$transaction((tx) => postMovements(tx, b, [{ productId: id, type: "SALE", quantity: "1" }]))).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
    });
    expect(await onHand(id)).toBe(10);
  });

  it("idempotency keys are scoped per business", async () => {
    const a = await createTenant("A");
    const b = await createTenant("B");
    const pa = await makeProduct(a, "0");
    const pb = await makeProduct(b, "0");
    const key = randomUUID();
    await receiveStock(a, receiveStockSchema.parse({ idempotencyKey: key, productId: pa, quantity: "1" }));
    const rb = await receiveStock(b, receiveStockSchema.parse({ idempotencyKey: key, productId: pb, quantity: "1" }));
    expect(rb.replayed).toBe(false);
    expect(await onHand(pb)).toBe(1);
  });
});
