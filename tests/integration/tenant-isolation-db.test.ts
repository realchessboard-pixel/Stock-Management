import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";

/**
 * Defence in depth: even if application code passed a foreign id, the
 * composite (businessId, id) foreign keys make cross-tenant links impossible.
 */
describe("database-level tenant isolation", () => {
  beforeEach(resetDatabase);

  it("rejects a product pointing at another business's category", async () => {
    const a = await createTenant("A");
    const b = await createTenant("B");
    const catB = await db.category.create({ data: { businessId: b.businessId, name: "Tools" } });
    await expect(
      db.product.create({ data: { businessId: a.businessId, name: "Hammer", sku: "H-1", categoryId: catB.id } }),
    ).rejects.toThrow();
  });

  it("rejects a balance/movement linking a product to another business's location", async () => {
    const a = await createTenant("A");
    const b = await createTenant("B");
    const product = await db.product.create({ data: { businessId: a.businessId, name: "Bolt", sku: "B-1" } });
    const locB = await db.stockLocation.findFirstOrThrow({ where: { businessId: b.businessId } });
    await expect(
      db.inventoryBalance.create({ data: { businessId: a.businessId, productId: product.id, locationId: locB.id } }),
    ).rejects.toThrow();
    await expect(
      db.stockMovement.create({
        data: {
          businessId: a.businessId,
          productId: product.id,
          locationId: locB.id,
          type: "OPENING",
          direction: "IN",
          quantity: 1,
          previousBalance: 0,
          newBalance: 1,
          userId: a.userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("scopes SKU uniqueness per business", async () => {
    const a = await createTenant("A");
    const b = await createTenant("B");
    await db.product.create({ data: { businessId: a.businessId, name: "Bolt", sku: "TB-004-SS" } });
    await expect(db.product.create({ data: { businessId: b.businessId, name: "Bolt", sku: "TB-004-SS" } })).resolves.toBeTruthy();
    await expect(db.product.create({ data: { businessId: a.businessId, name: "Dup", sku: "TB-004-SS" } })).rejects.toThrow();
  });
});

describe("append-only ledger and audit log", () => {
  beforeEach(resetDatabase);

  it("blocks UPDATE and DELETE on stock movements and audit logs", async () => {
    const a = await createTenant("A");
    const product = await db.product.create({ data: { businessId: a.businessId, name: "Bolt", sku: "B-1" } });
    const loc = await db.stockLocation.findFirstOrThrow({ where: { businessId: a.businessId } });
    const mv = await db.stockMovement.create({
      data: {
        businessId: a.businessId,
        productId: product.id,
        locationId: loc.id,
        type: "OPENING",
        direction: "IN",
        quantity: 5,
        previousBalance: 0,
        newBalance: 5,
        userId: a.userId,
      },
    });
    await expect(db.stockMovement.update({ where: { id: mv.id }, data: { reason: "edit" } })).rejects.toThrow(/append-only/);
    await expect(db.stockMovement.delete({ where: { id: mv.id } })).rejects.toThrow(/append-only/);

    const log = await db.auditLog.findFirstOrThrow({ where: { businessId: a.businessId } });
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "x" } })).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
  });

  it("rejects movements whose balance math doesn't add up, or with non-positive quantity", async () => {
    const a = await createTenant("A");
    const product = await db.product.create({ data: { businessId: a.businessId, name: "Bolt", sku: "B-1" } });
    const loc = await db.stockLocation.findFirstOrThrow({ where: { businessId: a.businessId } });
    const base = { businessId: a.businessId, productId: product.id, locationId: loc.id, userId: a.userId, type: "OPENING" as const };
    await expect(
      db.stockMovement.create({ data: { ...base, direction: "IN", quantity: 5, previousBalance: 0, newBalance: 6 } }),
    ).rejects.toThrow();
    await expect(
      db.stockMovement.create({ data: { ...base, direction: "IN", quantity: 0, previousBalance: 0, newBalance: 0 } }),
    ).rejects.toThrow();
  });
});
