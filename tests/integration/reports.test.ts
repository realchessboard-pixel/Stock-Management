import { beforeEach, describe, expect, it } from "vitest";
import { getDashboard } from "@/server/reports/dashboard";
import { listInventory } from "@/server/reports/inventory";
import { listMovements } from "@/server/reports/movements";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { addMember, createTenant } from "../helpers/factories";
import { adjust, makeProduct, receive, sell } from "../helpers/stock";

const inv = (status: "all" | "attention" | "low" | "out" | "in" = "all", extra = {}) => ({ status, sort: "name" as const, page: 1, ...extra });
const mv = (extra = {}) => ({ page: 1, ...extra });

describe("dashboard", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("computes totals, value, low/out counts and today's in/out (excluding opening stock)", async () => {
    const a = await makeProduct(ctx, "100", { minStock: "10", purchasePrice: "10" }); // OK
    const b = await makeProduct(ctx, "4", { minStock: "10", purchasePrice: "25" }); // LOW
    await makeProduct(ctx, "0", { minStock: "5" }); // OUT
    await receive(ctx, a, "20");
    await sell(ctx, a, "10");
    await adjust(ctx, a, { type: "DAMAGE", quantity: "2" });

    const d = await getDashboard(ctx);
    expect(d.totals).toEqual({ products: 3, units: 112, value: 108 * 10 + 4 * 25, outOfStock: 1, lowStock: 1 });
    expect(d.today).toEqual({ inUnits: 20, inMoves: 1, outUnits: 12, outMoves: 2 });
    expect(d.series.at(-1)).toMatchObject({ in: 20, out: 12 });
    expect(d.topMoving).toEqual([expect.objectContaining({ id: a, units: 10 })]);
    expect(d.lowStock.map((p) => p.qty)).toEqual([0, 4]); // out-of-stock first
    expect(d.recentReceipts[0].product.id).toBe(a);
    expect(d.recentMovements).toHaveLength(5); // 2 openings (0 opening posts nothing) + receive + sale + damage
    expect(b).toBeTruthy();
  });

  it("only counts the current business's data", async () => {
    await makeProduct(ctx, "50");
    const other = await createTenant("Other");
    const d = await getDashboard(other);
    expect(d.totals.products).toBe(0);
    expect(d.recentMovements).toHaveLength(0);
  });
});

describe("inventory and low-stock lists", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
    await makeProduct(ctx, "100", { name: "Alpha", minStock: "10" });
    await makeProduct(ctx, "4", { name: "Beta", minStock: "10" });
    await makeProduct(ctx, "0", { name: "Gamma", minStock: "5" });
    await makeProduct(ctx, "3", { name: "Delta" }); // no minimum → never LOW
  });

  it("filters by status in SQL", async () => {
    const names = async (s: Parameters<typeof inv>[0]) => (await listInventory(ctx, inv(s))).rows.map((r) => r.name);
    expect(await names("all")).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
    expect(await names("low")).toEqual(["Beta"]);
    expect(await names("out")).toEqual(["Gamma"]);
    expect(await names("attention")).toEqual(["Beta", "Gamma"]);
    expect(await names("in")).toEqual(["Alpha", "Beta", "Delta"]);
  });

  it("sorts most urgent first and reports shortage", async () => {
    const { rows } = await listInventory(ctx, { ...inv("attention"), sort: "shortage" });
    expect(rows.map((r) => [r.name, r.status, r.shortage])).toEqual([
      ["Gamma", "OUT", 5],
      ["Beta", "LOW", 6],
    ]);
  });

  it("searches and escapes LIKE wildcards", async () => {
    expect((await listInventory(ctx, inv("all", { q: "alp" }))).rows.map((r) => r.name)).toEqual(["Alpha"]);
    expect((await listInventory(ctx, inv("all", { q: "%" }))).total).toBe(0);
  });
});

describe("movement ledger", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("filters by product, type, direction, user and date, newest first", async () => {
    const staff = await addMember(ctx, "STAFF");
    const a = await makeProduct(ctx, "10", { name: "Alpha" });
    const b = await makeProduct(ctx, "10", { name: "Beta" });
    await receive(ctx, a, "5");
    await sell(staff, a, "2");
    await sell(ctx, b, "1");

    const all = await listMovements(ctx, mv());
    expect(all.total).toBe(5);
    expect(all.rows[0]).toMatchObject({ type: "SALE", product: { name: "Beta" } });

    expect((await listMovements(ctx, mv({ productId: a }))).total).toBe(3);
    expect((await listMovements(ctx, mv({ type: "SALE" }))).total).toBe(2);
    expect((await listMovements(ctx, mv({ direction: "IN" }))).total).toBe(3);
    expect((await listMovements(ctx, mv({ userId: staff.userId }))).rows.map((r) => r.user.name)).toEqual(["STAFF user"]);
    expect((await listMovements(ctx, mv({ q: "beta" }))).total).toBe(2);

    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    expect((await listMovements(ctx, mv({ from: tomorrow }))).total).toBe(0);
  });

  it("never returns another business's movements, even with its product id", async () => {
    const a = await makeProduct(ctx, "10");
    const other = await createTenant("Other");
    expect((await listMovements(other, mv({ productId: a }))).total).toBe(0);
  });
});
