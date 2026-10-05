import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { parseSpreadsheet } from "@/server/imports/parse";
import { commitImport, mapHeaders, validateImport } from "@/server/imports/products";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";
import { ledgerMatchesBalances, makeProduct, onHand } from "../helpers/stock";

const csvFile = (text: string, name = "products.csv") => new File([text], name, { type: "text/csv" });

const GOOD = `Product Name,SKU,Barcode,Category,Brand,Purchase Price,Selling Price,MRP,GST Rate,Minimum Stock,Opening Stock
"SS Tower Bolt 4""",TB-004-SS,8901234567890,Door Hardware,Dorset,45,80,95,18,10,50
Hettich Hinge,,,Furniture Hardware,Hettich,55,90,,18%,5,
Wood Screw,ws-1,,door hardware,,2.5,4,,5,100,1000
`;

async function validate(ctx: TenantContext, text: string) {
  return validateImport(ctx, await parseSpreadsheet(csvFile(text)));
}

describe("product import", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("maps common header spellings", () => {
    expect(mapHeaders(["Item Name", "MRP", "Qty", "GST %", "Rate", "Foo"]).map).toMatchObject({
      name: "Item Name",
      mrp: "MRP",
      openingQuantity: "Qty",
      gstRate: "GST %",
      sellingPrice: "Rate",
    });
  });

  it("validates and imports products, categories, brands, barcodes and opening stock atomically", async () => {
    const v = await validate(ctx, GOOD);
    expect(v.errors).toEqual([]);
    expect(v.rows).toHaveLength(3);

    const { result } = await commitImport(ctx, v.rows, { idempotencyKey: randomUUID(), generateBarcodes: true, fileName: "p.csv" });
    expect(result).toEqual({ created: 3, withOpeningStock: 2, barcodesGenerated: 2 });

    const products = await db.product.findMany({ where: { businessId: ctx.businessId }, include: { category: true, brand: true, barcodes: true }, orderBy: { name: "asc" } });
    expect(products.map((p) => [p.name, p.sku, p.category?.name ?? null, p.brand?.name ?? null, p.barcodes[0]?.code])).toEqual([
      ["Hettich Hinge", "SKU-00001", "Furniture Hardware", "Hettich", "SF00000001"],
      ['SS Tower Bolt 4"', "TB-004-SS", "Door Hardware", "Dorset", "8901234567890"],
      ["Wood Screw", "WS-1", "Door Hardware", null, "SF00000002"],
    ]);
    expect(await db.category.count({ where: { businessId: ctx.businessId } })).toBe(2); // "door hardware" matched case-insensitively
    expect(await onHand(products[1].id)).toBe(50);
    expect(await onHand(products[2].id)).toBe(1000);
    expect(await db.stockMovement.count({ where: { businessId: ctx.businessId, type: "OPENING", referenceType: "IMPORT" } })).toBe(2);
    expect(await ledgerMatchesBalances(ctx.businessId)).toEqual({ ok: true });
    expect(await db.auditLog.count({ where: { businessId: ctx.businessId, action: "product.imported" } })).toBe(1);
  });

  it("reports clear row-level errors and writes NOTHING when any row is bad", async () => {
    await makeProduct(ctx, "0", { sku: "EXISTING" });
    const before = await db.product.count({ where: { businessId: ctx.businessId } });
    const v = await validate(
      ctx,
      `Product Name,SKU,Barcode,Selling Price,MRP,Opening Stock,Unit
Good one,G-1,,10,,5,pcs
,X-1,,10,,,pcs
Bad barcode,B-1,AB CD,10,,,pcs
Dup sku,G-1,,10,,,pcs
Clash,existing,,10,,,pcs
Too pricey,P-1,,100,90,,pcs
Neg stock,N-1,,10,,-5,pcs
Weird unit,U-1,,10,,,bags
`,
    );
    const byRow = Object.fromEntries(v.errors.map((e) => [e.row, e.message]));
    expect(byRow[3]).toBe("Missing product name");
    expect(byRow[4]).toMatch(/^Barcode:/);
    expect(byRow[5]).toMatch(/Duplicate SKU "G-1" \(also on row 2\)/);
    expect(byRow[6]).toMatch(/SKU "EXISTING" already exists/);
    expect(byRow[7]).toMatch(/more than MRP/);
    expect(byRow[8]).toMatch(/^Opening Stock:/);
    expect(byRow[9]).toMatch(/^Unit:/);
    expect(byRow[2]).toBeUndefined();
    expect(v.rows.map((r) => r.rowNumber)).toEqual([2]);
    expect(v.total).toBe(8);
    expect(await db.product.count({ where: { businessId: ctx.businessId } })).toBe(before);
  });

  it("rejects a barcode that already belongs to another product", async () => {
    await makeProduct(ctx, "0", { barcodeMode: "existing", barcode: "8901111111111" });
    const v = await validate(ctx, `Product Name,Barcode\nNew,8901111111111\n`);
    expect(v.errors[0].message).toMatch(/already used by another product/);
  });

  it("does not see other shops' SKUs as conflicts", async () => {
    const other = await createTenant("Other");
    await makeProduct(other, "0", { sku: "TB-004-SS" });
    expect((await validate(ctx, GOOD)).errors).toEqual([]);
  });

  it("is idempotent: committing the same import twice creates products once", async () => {
    const v = await validate(ctx, GOOD);
    const key = randomUUID();
    await commitImport(ctx, v.rows, { idempotencyKey: key, generateBarcodes: false, fileName: "p.csv" });
    const again = await commitImport(ctx, (await validate(ctx, GOOD)).rows, { idempotencyKey: key, generateBarcodes: false, fileName: "p.csv" });
    expect(again.replayed).toBe(true);
    expect(await db.product.count({ where: { businessId: ctx.businessId } })).toBe(3);
  });

  it("reads Excel (.xlsx) files including numeric cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Products");
    ws.addRow(["Product Name", "Selling Price", "Opening Stock", "Barcode"]);
    ws.addRow(["Brass Handle", 220, 12, 8909999000011]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const sheet = await parseSpreadsheet(new File([buf], "p.xlsx"));
    const v = await validateImport(ctx, sheet);
    expect(v.errors).toEqual([]);
    expect(v.rows[0]).toMatchObject({ name: "Brass Handle", sellingPrice: "220", openingQuantity: "12", barcode: "8909999000011" });
  });

  it("rejects unsupported, empty and header-only files", async () => {
    await expect(parseSpreadsheet(new File(["x"], "p.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "INVALID_IMPORT" });
    await expect(parseSpreadsheet(csvFile(""))).rejects.toMatchObject({ code: "INVALID_IMPORT" });
    await expect(parseSpreadsheet(csvFile("Product Name\n"))).rejects.toMatchObject({ code: "INVALID_IMPORT" });
    const v = await validate(ctx, "Foo,Bar\n1,2\n");
    expect(v.errors[0].message).toMatch(/Missing "Product Name" column/);
  });
});
