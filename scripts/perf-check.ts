/** Times the hot queries against a seeded shop. Usage: npx tsx … scripts/perf-check.ts <businessId> */
import "dotenv/config";

async function main() {
  const businessId = process.argv[2];
  const { db } = await import("../src/server/db");
  const { findProductByCode, listProducts } = await import("../src/server/products/service");
  const { getDashboard } = await import("../src/server/reports/dashboard");
  const { listInventory } = await import("../src/server/reports/inventory");
  const { listMovements } = await import("../src/server/reports/movements");
  const owner = await db.membership.findFirstOrThrow({ where: { businessId, role: "OWNER" } });
  const ctx = { businessId, userId: owner.userId, role: "OWNER" as const, sessionId: "x", userName: "x", businessName: "x", allowNegativeStock: false };
  const someProduct = await db.product.findFirstOrThrow({ where: { businessId }, select: { id: true, barcodes: { select: { code: true } } } });
  const code = someProduct.barcodes[0].code;

  const cases: [string, () => Promise<unknown>][] = [
    ["scan: barcode lookup", () => findProductByCode(ctx, code)],
    ["scan: SKU lookup", () => findProductByCode(ctx, "SKU-02500")],
    ["product search 'hinge'", () => listProducts(ctx, { q: "hinge", status: "active", sort: "name", page: 1 })],
    ["product list page 1", () => listProducts(ctx, { status: "active", sort: "name", page: 1 })],
    ["product list page 150", () => listProducts(ctx, { status: "active", sort: "name", page: 150 })],
    ["dashboard", () => getDashboard(ctx)],
    ["inventory list", () => listInventory(ctx, { status: "all", sort: "name", page: 1 })],
    ["low stock list", () => listInventory(ctx, { status: "attention", sort: "shortage", page: 1 })],
    ["movements page 1", () => listMovements(ctx, { page: 1 })],
    ["product ledger", () => listMovements(ctx, { page: 1, productId: someProduct.id })],
    ["movements filter type+search", () => listMovements(ctx, { page: 1, type: "PURCHASE", q: "brass" })],
  ];
  for (const [name, fn] of cases) {
    await fn(); // warm up
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      await fn();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    console.log(`${name.padEnd(32)} median ${times[2].toFixed(1).padStart(7)} ms   max ${times[4].toFixed(1).padStart(7)} ms`);
  }
  await db.$disconnect();
}
main();
