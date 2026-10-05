import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { stockStatus } from "@/lib/stock-status";
import type { InventoryFilter } from "@/lib/validation/reports";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export const INVENTORY_PAGE_SIZE = 30;

const ORDER: Record<InventoryFilter["sort"], Prisma.Sql> = {
  name: Prisma.sql`name ASC, id ASC`,
  qty: Prisma.sql`qty ASC, name ASC`,
  "-qty": Prisma.sql`qty DESC, name ASC`,
  "-value": Prisma.sql`value DESC, name ASC`,
  // Most urgent first: out of stock, then lowest stock relative to minimum.
  shortage: Prisma.sql`(qty <= 0) DESC, (qty / NULLIF("minStock", 0)) ASC NULLS LAST, name ASC`,
};

/**
 * Stock on hand per product (optionally for one location) with value and
 * status. Filtering by status happens in SQL so pagination stays correct.
 */
export async function listInventory(ctx: TenantContext, f: InventoryFilter) {
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const statusSql =
    f.status === "out"
      ? Prisma.sql`qty <= 0`
      : f.status === "low"
        ? Prisma.sql`qty > 0 AND "minStock" > 0 AND qty < "minStock"`
        : f.status === "attention"
          ? Prisma.sql`(qty <= 0 OR ("minStock" > 0 AND qty < "minStock"))`
          : f.status === "in"
            ? Prisma.sql`qty > 0`
            : Prisma.sql`TRUE`;

  const base = Prisma.sql`
    WITH stock AS (
      SELECT p.id, p.name, p.sku, p.unit, p."minStock", p."purchasePrice", p."sellingPrice", p."preferredSupplierId",
             c.name AS category,
             COALESCE(SUM(ib.quantity), 0) AS qty,
             COALESCE(SUM(ib.quantity), 0) * p."purchasePrice" AS value
      FROM "Product" p
      LEFT JOIN "InventoryBalance" ib ON ib."productId" = p.id ${f.locationId ? Prisma.sql`AND ib."locationId" = ${f.locationId}` : Prisma.empty}
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE p."businessId" = ${ctx.businessId} AND p."archivedAt" IS NULL
        ${f.categoryId ? Prisma.sql`AND p."categoryId" = ${f.categoryId}` : Prisma.empty}
        ${like ? Prisma.sql`AND (p.name ILIKE ${like} OR p.sku ILIKE ${like} OR EXISTS (SELECT 1 FROM "Barcode" bc WHERE bc."productId" = p.id AND bc.code ILIKE ${like}))` : Prisma.empty}
      GROUP BY p.id, c.name
    )`;

  const [rows, agg] = await Promise.all([
    db.$queryRaw<
      { id: string; name: string; sku: string; unit: string; minStock: Prisma.Decimal; purchasePrice: Prisma.Decimal; sellingPrice: Prisma.Decimal; category: string | null; qty: Prisma.Decimal; value: Prisma.Decimal }[]
    >`${base} SELECT * FROM stock WHERE ${statusSql} ORDER BY ${ORDER[f.sort]} LIMIT ${INVENTORY_PAGE_SIZE} OFFSET ${(f.page - 1) * INVENTORY_PAGE_SIZE}`,
    db.$queryRaw<{ total: bigint; units: Prisma.Decimal | null; value: Prisma.Decimal | null }[]>`
      ${base} SELECT count(*) AS total, SUM(GREATEST(qty, 0)) AS units, SUM(GREATEST(value, 0)) AS value FROM stock WHERE ${statusSql}`,
  ]);

  const total = Number(agg[0]?.total ?? 0);
  return {
    total,
    units: Number(agg[0]?.units ?? 0),
    value: Number(agg[0]?.value ?? 0),
    page: f.page,
    pageCount: Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE)),
    rows: rows.map((r) => {
      const qty = Number(r.qty);
      const min = Number(r.minStock);
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        category: r.category,
        qty,
        minStock: min,
        shortage: min > 0 ? Math.max(0, min - qty) : qty <= 0 ? 0 : 0,
        purchasePrice: r.purchasePrice.toString(),
        value: Number(r.value),
        status: stockStatus(qty, min),
      };
    }),
  };
}
export type InventoryRow = Awaited<ReturnType<typeof listInventory>>["rows"][number];
