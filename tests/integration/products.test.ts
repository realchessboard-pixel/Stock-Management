import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductSchema, supplierSchema, updateProductSchema } from "@/lib/validation/catalog";
import { saveCategory, deleteCategory } from "@/server/catalog/categories";
import { saveSupplier } from "@/server/catalog/suppliers";
import { db } from "@/server/db";
import {
  createProduct,
  findProductByCode,
  getProduct,
  listProducts,
  setProductArchived,
  updateProduct,
} from "@/server/products/service";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";

function productInput(overrides: Record<string, unknown> = {}) {
  return createProductSchema.parse({
    name: "SS Tower Bolt 4\"",
    sku: "tb-004-ss",
    unit: "pcs",
    purchasePrice: "45",
    sellingPrice: "80.50",
    mrp: "95",
    gstRate: "18",
    minStock: "10",
    barcodeMode: "generate",
    idempotencyKey: randomUUID(),
    ...overrides,
  });
}

describe("product creation", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("creates a product with upper-cased SKU, generated Code 128 barcode and audit entry", async () => {
    const { id } = await createProduct(ctx, productInput({ brandName: "Godrej" }));
    const p = await getProduct(ctx, id);
    expect(p).toMatchObject({ name: 'SS Tower Bolt 4"', sku: "TB-004-SS", unit: "pcs", onHand: 0, status: "OUT" });
    expect(p!.sellingPrice.toString()).toBe("80.5");
    expect(p!.barcode).toEqual({ code: "SF00000001", kind: "GENERATED" });
    expect(p!.brand?.name).toBe("Godrej");
    expect(await db.auditLog.count({ where: { businessId: ctx.businessId, action: "product.created", entityId: id } })).toBe(1);
  });

  it("auto-generates a SKU when left blank and increments internal barcodes", async () => {
    const a = await createProduct(ctx, productInput({ sku: "" }));
    const b = await createProduct(ctx, productInput({ sku: "" }));
    const [pa, pb] = await Promise.all([getProduct(ctx, a.id), getProduct(ctx, b.id)]);
    expect(pa!.sku).toBe("SKU-00001");
    expect(pb!.sku).toBe("SKU-00002");
    expect(pa!.barcode!.code).toBe("SF00000001");
    expect(pb!.barcode!.code).toBe("SF00000002");
  });

  it("rejects a duplicate SKU in the same business", async () => {
    await createProduct(ctx, productInput());
    await expect(createProduct(ctx, productInput())).rejects.toMatchObject({ code: "DUPLICATE_SKU" });
  });

  it("enforces barcode uniqueness per business but allows the same manufacturer barcode in another shop", async () => {
    await createProduct(ctx, productInput({ barcodeMode: "existing", barcode: "8901234567890" }));
    await expect(
      createProduct(ctx, productInput({ sku: "OTHER", barcodeMode: "existing", barcode: "8901234567890" })),
    ).rejects.toMatchObject({ code: "DUPLICATE_BARCODE" });

    const other = await createTenant("Other Shop");
    await expect(createProduct(other, productInput({ barcodeMode: "existing", barcode: "8901234567890" }))).resolves.toBeTruthy();
  });

  it("skips an internal barcode value that was already typed in manually", async () => {
    await createProduct(ctx, productInput({ sku: "M1", barcodeMode: "existing", barcode: "SF00000001" }));
    const { id } = await createProduct(ctx, productInput({ sku: "G1" }));
    expect((await getProduct(ctx, id))!.barcode!.code).toBe("SF00000002");
  });

  it("is idempotent: the same submission twice (even concurrently) creates one product", async () => {
    const input = productInput();
    const [r1, r2] = await Promise.all([createProduct(ctx, input), createProduct(ctx, input)]);
    expect(r1.id).toBe(r2.id);
    expect([r1.replayed, r2.replayed].sort()).toEqual([false, true]);
    expect(await db.product.count({ where: { businessId: ctx.businessId } })).toBe(1);
  });

  it("rejects selling price above MRP and missing manufacturer barcode at validation", () => {
    expect(() => productInput({ sellingPrice: "100", mrp: "90" })).toThrow();
    expect(() => productInput({ barcodeMode: "existing", barcode: "" })).toThrow();
    expect(() => productInput({ purchasePrice: "-1" })).toThrow();
    expect(() => productInput({ purchasePrice: "1.234" })).toThrow();
  });

  it("refuses to link another business's category", async () => {
    const other = await createTenant("Other");
    const { id: foreignCat } = await saveCategory(other, { name: "Tools" });
    await expect(createProduct(ctx, productInput({ categoryId: foreignCat }))).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("product edit, archive, search", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("updates fields, swaps barcode and audits only the changes", async () => {
    const { id } = await createProduct(ctx, productInput());
    await updateProduct(
      ctx,
      updateProductSchema.parse({
        id,
        name: "SS Tower Bolt 4 inch",
        sku: "TB-004-SS",
        unit: "pcs",
        purchasePrice: "45",
        sellingPrice: "85",
        mrp: "95",
        gstRate: "18",
        minStock: "10",
        barcodeMode: "existing",
        barcode: "ABC-123",
      }),
    );
    const p = await getProduct(ctx, id);
    expect(p!.name).toBe("SS Tower Bolt 4 inch");
    expect(p!.barcode).toEqual({ code: "ABC-123", kind: "MANUFACTURER" });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "product.updated", entityId: id } });
    const changed = (log.metadata as { changed: Record<string, unknown> }).changed;
    expect(Object.keys(changed).sort()).toEqual(["barcode", "name", "sellingPrice"]);
  });

  it("archives and restores; archived products are hidden from the default list", async () => {
    const { id } = await createProduct(ctx, productInput());
    await setProductArchived(ctx, id, true);
    const base = { status: "active", sort: "name", page: 1 } as const;
    expect((await listProducts(ctx, base)).total).toBe(0);
    expect((await listProducts(ctx, { ...base, status: "archived" })).total).toBe(1);
    await setProductArchived(ctx, id, false);
    expect((await listProducts(ctx, base)).total).toBe(1);
  });

  it("searches by name, SKU, barcode, brand and category", async () => {
    const { id: catId } = await saveCategory(ctx, { name: "Door Hardware" });
    await createProduct(ctx, productInput({ categoryId: catId, brandName: "Dorset" }));
    await createProduct(ctx, productInput({ name: "Hammer", sku: "HM-1", barcodeMode: "existing", barcode: "8900001" }));
    const search = async (q: string) =>
      (await listProducts(ctx, { q, status: "active", sort: "name", page: 1 })).rows.map((r) => r.name);
    expect(await search("tower")).toEqual(['SS Tower Bolt 4"']);
    expect(await search("tb-004")).toEqual(['SS Tower Bolt 4"']);
    expect(await search("8900001")).toEqual(["Hammer"]);
    expect(await search("dorset")).toEqual(['SS Tower Bolt 4"']);
    expect(await search("door hard")).toEqual(['SS Tower Bolt 4"']);
  });

  it("finds a product by exact barcode or SKU, scoped to the business", async () => {
    const { id } = await createProduct(ctx, productInput());
    expect((await findProductByCode(ctx, "SF00000001"))?.id).toBe(id);
    expect((await findProductByCode(ctx, "tb-004-ss"))?.id).toBe(id);
    expect(await findProductByCode(ctx, "SF0000000")).toBeNull();
    const other = await createTenant("Other");
    expect(await findProductByCode(other, "SF00000001")).toBeNull();
  });

  it("cannot read, edit or archive another business's product", async () => {
    const { id } = await createProduct(ctx, productInput());
    const other = await createTenant("Other");
    expect(await getProduct(other, id)).toBeNull();
    await expect(setProductArchived(other, id, true)).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(
      updateProduct(other, updateProductSchema.parse({ id, name: "Hacked", unit: "pcs", barcodeMode: "none" })),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    expect((await getProduct(ctx, id))!.name).toBe('SS Tower Bolt 4"');
  });
});

describe("categories and suppliers", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("rejects duplicate category names and uncategorises products on delete", async () => {
    const { id: catId } = await saveCategory(ctx, { name: "Tools" });
    await expect(saveCategory(ctx, { name: "Tools" })).rejects.toMatchObject({ code: "DUPLICATE" });
    const { id } = await createProduct(ctx, productInput({ categoryId: catId }));
    await deleteCategory(ctx, catId);
    expect((await getProduct(ctx, id))!.categoryId).toBeNull();
  });

  it("validates GSTIN and saves suppliers", async () => {
    expect(supplierSchema.safeParse({ name: "X", gstin: "BAD" }).success).toBe(false);
    const input = supplierSchema.parse({ name: "Ravi Traders", gstin: "27abcde1234f1z5", phone: "98765 43210" });
    expect(input.gstin).toBe("27ABCDE1234F1Z5");
    const { id } = await saveSupplier(ctx, input);
    const other = await createTenant("Other");
    await expect(saveSupplier(other, { ...input, id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
