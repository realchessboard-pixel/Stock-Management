import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, businessDateKey, startOfBusinessDay } from "@/lib/time";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

type Num = Prisma.Decimal | number | bigint | string | null;
const n = (v: Num) => (v === null ? 0 : Number(v.toString()));

/**
 * Dashboard figures, computed in SQL (aggregates, not row loading) so they
 * stay fast with thousands of products. Archived products are excluded.
 */
export async function getDashboard(ctx: TenantContext) {
  const b = ctx.businessId;
  const todayKey = businessDateKey(new Date());
  const todayStart = startOfBusinessDay(todayKey);
  const weekStart = startOfBusinessDay(addDays(todayKey, -6));
  const monthStart = startOfBusinessDay(addDays(todayKey, -29));

  const [totals, today, week, topMoving, lowStock, recentReceipts, recentMovements] = await Promise.all([
    db.$queryRaw<{ products: bigint; units: Num; value: Num; out_of_stock: bigint; low_stock: bigint }[]>`
      WITH stock AS (
        SELECT p.id, p."minStock", p."purchasePrice", COALESCE(SUM(ib.quantity), 0) AS qty
        FROM "Product" p
        LEFT JOIN "InventoryBalance" ib ON ib."productId" = p.id
        WHERE p."businessId" = ${b} AND p."archivedAt" IS NULL
        GROUP BY p.id
      )
      SELECT count(*) AS products,
             COALESCE(SUM(CASE WHEN qty > 0 THEN qty ELSE 0 END), 0) AS units,
             COALESCE(SUM(CASE WHEN qty > 0 THEN qty * "purchasePrice" ELSE 0 END), 0) AS value,
             count(*) FILTER (WHERE qty <= 0) AS out_of_stock,
             count(*) FILTER (WHERE qty > 0 AND "minStock" > 0 AND qty < "minStock") AS low_stock
      FROM stock`,
    db.$queryRaw<{ direction: "IN" | "OUT"; units: Num; moves: bigint }[]>`
      SELECT direction, COALESCE(SUM(quantity), 0) AS units, count(*) AS moves
      FROM "StockMovement"
      WHERE "businessId" = ${b} AND "createdAt" >= ${todayStart} AND type <> 'OPENING'
      GROUP BY direction`,
    db.$queryRaw<{ day: string; direction: "IN" | "OUT"; units: Num }[]>`
      -- createdAt is stored as UTC without zone: tag it UTC, then convert to IST.
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, direction, SUM(quantity) AS units
      FROM "StockMovement"
      WHERE "businessId" = ${b} AND "createdAt" >= ${weekStart} AND type <> 'OPENING'
      GROUP BY 1, 2`,
    db.$queryRaw<{ id: string; name: string; unit: string; units: Num }[]>`
      SELECT p.id, p.name, p.unit, SUM(m.quantity) AS units
      FROM "StockMovement" m JOIN "Product" p ON p.id = m."productId"
      WHERE m."businessId" = ${b} AND m.type = 'SALE' AND m."createdAt" >= ${monthStart}
      GROUP BY p.id, p.name, p.unit
      ORDER BY units DESC
      LIMIT 5`,
    db.$queryRaw<{ id: string; name: string; unit: string; qty: Num; min_stock: Num }[]>`
      SELECT p.id, p.name, p.unit, COALESCE(SUM(ib.quantity), 0) AS qty, p."minStock" AS min_stock
      FROM "Product" p LEFT JOIN "InventoryBalance" ib ON ib."productId" = p.id
      WHERE p."businessId" = ${b} AND p."archivedAt" IS NULL
      GROUP BY p.id
      HAVING COALESCE(SUM(ib.quantity), 0) <= 0 OR (p."minStock" > 0 AND COALESCE(SUM(ib.quantity), 0) < p."minStock")
      ORDER BY (COALESCE(SUM(ib.quantity), 0) <= 0) DESC, COALESCE(SUM(ib.quantity), 0) / NULLIF(p."minStock", 0) ASC NULLS LAST, p.name
      LIMIT 5`,
    db.stockMovement.findMany({
      where: { businessId: b, type: "PURCHASE" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, quantity: true, createdAt: true, product: { select: { id: true, name: true, unit: true } } },
    }),
    db.stockMovement.findMany({
      where: { businessId: b },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        type: true,
        direction: true,
        quantity: true,
        newBalance: true,
        createdAt: true,
        product: { select: { id: true, name: true, unit: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  const t = totals[0];
  const todayIn = today.find((r) => r.direction === "IN");
  const todayOut = today.find((r) => r.direction === "OUT");
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayKey, i - 6));
  const series = days.map((day) => ({
    day,
    in: n(week.find((r) => r.day === day && r.direction === "IN")?.units ?? 0),
    out: n(week.find((r) => r.day === day && r.direction === "OUT")?.units ?? 0),
  }));

  return {
    totals: {
      products: n(t?.products ?? 0),
      units: n(t?.units ?? 0),
      value: n(t?.value ?? 0),
      outOfStock: n(t?.out_of_stock ?? 0),
      lowStock: n(t?.low_stock ?? 0),
    },
    today: {
      inUnits: n(todayIn?.units ?? 0),
      inMoves: n(todayIn?.moves ?? 0),
      outUnits: n(todayOut?.units ?? 0),
      outMoves: n(todayOut?.moves ?? 0),
    },
    series,
    topMoving: topMoving.map((r) => ({ id: r.id, name: r.name, unit: r.unit, units: n(r.units) })),
    lowStock: lowStock.map((r) => ({ id: r.id, name: r.name, unit: r.unit, qty: n(r.qty), minStock: n(r.min_stock) })),
    recentReceipts: recentReceipts.map((r) => ({ id: r.id, quantity: n(r.quantity), createdAt: r.createdAt, product: r.product })),
    recentMovements: recentMovements.map((m) => ({ ...m, quantity: m.quantity.toString(), newBalance: m.newBalance.toString() })),
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
