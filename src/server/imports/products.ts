import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { productFields, barcodeSchema } from "@/lib/validation/catalog";
import { quantityOrZero } from "@/lib/validation/numbers";
import { writeAudit } from "@/server/audit";
import { formatInternalBarcode } from "@/server/barcodes";
import { assertWithinLimit } from "@/server/billing/entitlements";
import { db, type Tx } from "@/server/db";
import { runIdempotent } from "@/server/idempotency";
import { postMovements, type MovementLine } from "@/server/inventory/engine";
import type { TenantContext } from "@/server/tenancy/context";
import type { RawSheet } from "./parse";

/**
 * PRODUCT IMPORT — validate everything first, then write everything in ONE
 * transaction (products, barcodes, categories, brands, opening stock). Any
 * error means nothing is written, so a bad file can't half-corrupt inventory.
 */

export const IMPORT_COLUMNS = [
  { key: "name", label: "Product Name", aliases: ["name", "product", "item", "item name", "product name"], required: true },
  { key: "sku", label: "SKU", aliases: ["sku", "item code", "code"] },
  { key: "barcode", label: "Barcode", aliases: ["barcode", "ean", "upc", "bar code"] },
  { key: "category", label: "Category", aliases: ["category", "group"] },
  { key: "brand", label: "Brand", aliases: ["brand", "make", "company"] },
  { key: "unit", label: "Unit", aliases: ["unit", "uom"] },
  { key: "purchasePrice", label: "Purchase Price", aliases: ["purchase price", "cost", "cost price", "buying price"] },
  { key: "sellingPrice", label: "Selling Price", aliases: ["selling price", "price", "sale price", "rate"] },
  { key: "mrp", label: "MRP", aliases: ["mrp"] },
  { key: "gstRate", label: "GST Rate", aliases: ["gst rate", "gst", "gst %", "tax rate"] },
  { key: "hsnSac", label: "HSN", aliases: ["hsn", "hsn/sac", "hsn code", "sac"] },
  { key: "minStock", label: "Minimum Stock", aliases: ["minimum stock", "min stock", "reorder level", "min qty"] },
  { key: "openingQuantity", label: "Opening Stock", aliases: ["opening stock", "stock", "quantity", "qty", "current stock"] },
] as const;
type ColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

const norm = (s: string) => s.toLowerCase().replace(/[_\s]+/g, " ").replace(/[()]/g, "").trim();

export function mapHeaders(headers: string[]): { map: Partial<Record<ColumnKey, string>>; unknown: string[] } {
  const map: Partial<Record<ColumnKey, string>> = {};
  const unknown: string[] = [];
  for (const h of headers) {
    const col = IMPORT_COLUMNS.find((c) => (c.aliases as readonly string[]).includes(norm(h)) || norm(c.label) === norm(h));
    if (col && !map[col.key]) map[col.key] = h;
    else if (h) unknown.push(h);
  }
  return { map, unknown };
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const rowSchema = z.object({
  name: productFields.name,
  sku: productFields.sku,
  barcode: z.preprocess(blank, barcodeSchema.optional()),
  category: z.preprocess(blank, z.string().trim().max(80).transform((v) => v.replace(/\s+/g, " ")).optional()),
  brand: z.preprocess(blank, z.string().trim().max(80).transform((v) => v.replace(/\s+/g, " ")).optional()),
  unit: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() || undefined : v), productFields.unit),
  purchasePrice: productFields.purchasePrice,
  sellingPrice: productFields.sellingPrice,
  mrp: productFields.mrp,
  gstRate: z.preprocess((v) => (typeof v === "string" ? v.replace("%", "") : v), productFields.gstRate),
  hsnSac: productFields.hsnSac,
  minStock: productFields.minStock,
  openingQuantity: z.preprocess((v) => blank(v) ?? "0", quantityOrZero("Opening stock")),
});
export type ImportRow = z.infer<typeof rowSchema> & { rowNumber: number };
export type ImportError = { row: number; column?: string; message: string };

export type ValidationResult = {
  rows: ImportRow[];
  errors: ImportError[];
  unknownColumns: string[];
  total: number;
};

/** Validates every row against the schema, within-file duplicates and existing data. */
export async function validateImport(ctx: TenantContext, sheet: RawSheet): Promise<ValidationResult> {
  const { map, unknown } = mapHeaders(sheet.headers);
  const errors: ImportError[] = [];
  if (!map.name) {
    return { rows: [], errors: [{ row: 1, message: 'Missing "Product Name" column. Download the template to see the expected columns.' }], unknownColumns: unknown, total: sheet.rows.length };
  }

  const rows: ImportRow[] = [];
  sheet.rows.forEach((raw, i) => {
    const rowNumber = i + 2; // row 1 is the header
    const input = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, map[c.key] ? raw[map[c.key]!] ?? "" : ""]));
    if (Object.values(input).every((v) => v === "")) return; // fully empty line
    const parsed = rowSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as ColumnKey;
        const col = IMPORT_COLUMNS.find((c) => c.key === key);
        const message = key === "name" && input.name === "" ? "Missing product name" : `${col?.label ?? key}: ${issue.message}`;
        errors.push({ row: rowNumber, column: col?.label, message });
      }
      return;
    }
    if (parsed.data.mrp !== undefined && Number(parsed.data.sellingPrice) > Number(parsed.data.mrp)) {
      errors.push({ row: rowNumber, column: "Selling Price", message: "Selling price is more than MRP" });
      return;
    }
    rows.push({ ...parsed.data, rowNumber });
  });

  // Duplicates inside the file
  const seenSku = new Map<string, number>();
  const seenCode = new Map<string, number>();
  for (const r of rows) {
    if (r.sku) {
      const first = seenSku.get(r.sku);
      if (first) errors.push({ row: r.rowNumber, column: "SKU", message: `Duplicate SKU "${r.sku}" (also on row ${first})` });
      else seenSku.set(r.sku, r.rowNumber);
    }
    if (r.barcode) {
      const first = seenCode.get(r.barcode);
      if (first) errors.push({ row: r.rowNumber, column: "Barcode", message: `Duplicate barcode "${r.barcode}" (also on row ${first})` });
      else seenCode.set(r.barcode, r.rowNumber);
    }
  }

  // Conflicts with products already in this shop
  const skus = [...seenSku.keys()];
  const codes = [...seenCode.keys()];
  const [existingSkus, existingCodes] = await Promise.all([
    skus.length ? db.product.findMany({ where: { businessId: ctx.businessId, sku: { in: skus } }, select: { sku: true } }) : [],
    codes.length ? db.barcode.findMany({ where: { businessId: ctx.businessId, code: { in: codes } }, select: { code: true } }) : [],
  ]);
  for (const { sku } of existingSkus) errors.push({ row: seenSku.get(sku)!, column: "SKU", message: `SKU "${sku}" already exists in your products` });
  for (const { code } of existingCodes) errors.push({ row: seenCode.get(code)!, column: "Barcode", message: `Barcode "${code}" is already used by another product` });

  errors.sort((a, b) => a.row - b.row);
  const errorRows = new Set(errors.map((e) => e.row));
  const clean = rows.filter((r) => !errorRows.has(r.rowNumber));
  // total = every non-empty data row; rows = only rows with no errors at all.
  return { rows: clean, errors, unknownColumns: unknown, total: clean.length + errorRows.size };
}

/** Reserves `n` consecutive values of a per-business counter in one UPDATE. */
async function reserveSeq(tx: Tx, businessId: string, column: "barcodeSeq" | "skuSeq", n: number): Promise<number[]> {
  if (n === 0) return [];
  const updated = await tx.business.update({
    where: { id: businessId },
    data: { [column]: { increment: n } },
    select: { barcodeSeq: true, skuSeq: true },
  });
  const end = updated[column];
  return Array.from({ length: n }, (_, i) => end - n + 1 + i);
}

/** Finds-or-creates names (case-insensitive) and returns name→id. */
async function resolveNames(tx: Tx, ctx: TenantContext, model: "category" | "brand", names: string[]) {
  // First spelling in the file wins ("Door Hardware" then "door hardware" → "Door Hardware").
  const firstSpelling = new Map<string, string>();
  for (const n of names) {
    const clean = n.replace(/\s+/g, " ").trim();
    if (!firstSpelling.has(clean.toLowerCase())) firstSpelling.set(clean.toLowerCase(), clean);
  }
  const unique = [...firstSpelling.values()];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const delegate = (model === "category" ? tx.category : tx.brand) as unknown as {
    findMany: (a: unknown) => Promise<{ id: string; name: string }[]>;
    createMany: (a: unknown) => Promise<unknown>;
  };
  const existing = await delegate.findMany({ where: { businessId: ctx.businessId }, select: { id: true, name: true } });
  for (const e of existing) out.set(e.name.toLowerCase(), e.id);
  const missing = unique.filter((n) => !out.has(n.toLowerCase()));
  if (missing.length) {
    await delegate.createMany({ data: missing.map((name) => ({ businessId: ctx.businessId, name })), skipDuplicates: true });
    const created = await delegate.findMany({ where: { businessId: ctx.businessId, name: { in: missing } }, select: { id: true, name: true } });
    for (const c of created) out.set(c.name.toLowerCase(), c.id);
  }
  return out;
}

export async function commitImport(
  ctx: TenantContext,
  rows: ImportRow[],
  opts: { idempotencyKey: string; generateBarcodes: boolean; fileName: string },
) {
  if (rows.length === 0) throw new AppError("INVALID_IMPORT", "There are no products to import.");
  await assertWithinLimit(ctx, "products", rows.length);

  return runIdempotent<{ created: number; withOpeningStock: number; barcodesGenerated: number }>(
    ctx.businessId,
    opts.idempotencyKey,
    "product.import",
    async (tx) => {
      const categories = await resolveNames(tx, ctx, "category", rows.flatMap((r) => (r.category ? [r.category] : [])));
      const brands = await resolveNames(tx, ctx, "brand", rows.flatMap((r) => (r.brand ? [r.brand] : [])));

      // SKUs for blank cells, skipping any value that's already taken.
      const needSku = rows.filter((r) => !r.sku);
      const taken = new Set(rows.flatMap((r) => (r.sku ? [r.sku] : [])));
      const skuCandidates = (await reserveSeq(tx, ctx.businessId, "skuSeq", needSku.length + 20)).map((n) => `SKU-${String(n).padStart(5, "0")}`);
      const existingSku = new Set(
        (await tx.product.findMany({ where: { businessId: ctx.businessId, sku: { in: skuCandidates } }, select: { sku: true } })).map((p) => p.sku),
      );
      const freeSkus = skuCandidates.filter((s) => !existingSku.has(s) && !taken.has(s));
      if (freeSkus.length < needSku.length) throw new AppError("CONFLICT");
      needSku.forEach((r, i) => (r.sku = freeSkus[i]));

      // Internal barcodes for rows without one (optional).
      const needCode = opts.generateBarcodes ? rows.filter((r) => !r.barcode) : [];
      const codeCandidates = (await reserveSeq(tx, ctx.businessId, "barcodeSeq", needCode.length ? needCode.length + 20 : 0)).map(formatInternalBarcode);
      const fileCodes = new Set(rows.flatMap((r) => (r.barcode ? [r.barcode] : [])));
      const existingCodes = new Set(
        (await tx.barcode.findMany({ where: { businessId: ctx.businessId, code: { in: codeCandidates } }, select: { code: true } })).map((b) => b.code),
      );
      const freeCodes = codeCandidates.filter((c) => !existingCodes.has(c) && !fileCodes.has(c));
      if (freeCodes.length < needCode.length) throw new AppError("CONFLICT");
      const generated = new Map(needCode.map((r, i) => [r.rowNumber, freeCodes[i]]));

      await tx.product.createMany({
        data: rows.map((r) => ({
          businessId: ctx.businessId,
          name: r.name,
          sku: r.sku!,
          unit: r.unit,
          categoryId: r.category ? (categories.get(r.category.toLowerCase()) ?? null) : null,
          brandId: r.brand ? (brands.get(r.brand.toLowerCase()) ?? null) : null,
          purchasePrice: r.purchasePrice,
          sellingPrice: r.sellingPrice,
          mrp: r.mrp ?? null,
          gstRate: r.gstRate,
          hsnSac: r.hsnSac ?? null,
          minStock: r.minStock,
        })),
      });
      const created = await tx.product.findMany({
        where: { businessId: ctx.businessId, sku: { in: rows.map((r) => r.sku!) } },
        select: { id: true, sku: true },
      });
      const idBySku = new Map(created.map((p) => [p.sku, p.id]));

      const barcodeRows = rows.flatMap((r) => {
        const code = r.barcode ?? generated.get(r.rowNumber);
        if (!code) return [];
        return [{ businessId: ctx.businessId, productId: idBySku.get(r.sku!)!, code, kind: r.barcode ? ("MANUFACTURER" as const) : ("GENERATED" as const) }];
      });
      if (barcodeRows.length) await tx.barcode.createMany({ data: barcodeRows });

      // Opening stock through the movement engine (ledger + balances stay consistent).
      const lines: MovementLine[] = rows
        .filter((r) => new Prisma.Decimal(r.openingQuantity).gt(0))
        .map((r) => ({ productId: idBySku.get(r.sku!)!, type: "OPENING", quantity: r.openingQuantity, unitCost: r.purchasePrice, reason: "Opening stock (import)" }));
      if (lines.length) await postMovements(tx, ctx, lines, { referenceType: "IMPORT" });

      const summary = { created: rows.length, withOpeningStock: lines.length, barcodesGenerated: generated.size };
      await writeAudit(tx, {
        businessId: ctx.businessId,
        userId: ctx.userId,
        action: "product.imported",
        entityType: "Product",
        metadata: { ...summary, fileName: opts.fileName.slice(0, 120) },
      });
      return summary;
    },
    { timeoutMs: 180_000 },
  );
}

/** CSV template with the expected headers and one example row. */
export function importTemplateCsv(): string {
  const header = IMPORT_COLUMNS.map((c) => c.label).join(",");
  const example = ['SS Tower Bolt 4"', "TB-004-SS", "", "Door Hardware", "Dorset", "pcs", "45", "80", "95", "18", "8302", "10", "50"]
    .map((v) => (v.includes('"') || v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v))
    .join(",");
  return `﻿${header}\r\n${example}\r\n`;
}
