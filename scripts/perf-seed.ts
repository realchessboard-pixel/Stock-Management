/**
 * Creates a large demo shop (5,000 products, ~50,000 movements) for
 * performance checks. Usage: npx tsx scripts/perf-seed.ts
 * Prints the login. Uses the real services, so the ledger stays consistent.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

async function main() {
  const { registerBusiness } = await import("../src/server/business/accounts");
  const { commitImport, validateImport } = await import("../src/server/imports/products");
  const { postMovements } = await import("../src/server/inventory/engine");
  const { db } = await import("../src/server/db");

  const email = `perf-${Date.now()}@stockflow.test`;
  const { userId, businessId } = await registerBusiness({
    businessName: "Perf Hardware Mart",
    ownerName: "Perf Owner",
    identifier: { kind: "email", value: email },
    password: "perf-password-1",
  });
  const ctx = { businessId, userId, role: "OWNER" as const, sessionId: "seed", userName: "Perf Owner", businessName: "Perf", allowNegativeStock: false };

  const cats = ["Door Hardware", "Furniture Hardware", "Kitchen Hardware", "Wardrobe Hardware", "Glass Hardware", "Bathroom Hardware", "Tools", "Fasteners", "Aluminium Hardware", "Architectural Hardware"];
  const rows = Array.from({ length: 5000 }, (_, i) => ({
    "Product Name": `${["SS", "Brass", "Zinc", "MS", "Aluminium"][i % 5]} ${["Tower Bolt", "Hinge", "Handle", "Screw", "Channel", "Lock", "Knob", "Bracket"][i % 8]} ${(i % 12) + 1}in #${i}`,
    Category: cats[i % cats.length],
    "Purchase Price": String(10 + (i % 300)),
    "Selling Price": String(15 + (i % 300) * 1.4),
    "Minimum Stock": String(i % 20),
    "Opening Stock": String(i % 9 === 0 ? 0 : 20 + (i % 80)),
  }));
  let t = Date.now();
  const v = await validateImport(ctx, { headers: Object.keys(rows[0]), rows });
  await commitImport(ctx, v.rows, { idempotencyKey: randomUUID(), generateBarcodes: true, fileName: "perf" });
  console.log(`imported 5000 products in ${Date.now() - t} ms`);

  const products = await db.product.findMany({ where: { businessId }, select: { id: true } });
  t = Date.now();
  let posted = 0;
  for (let batch = 0; batch < 90; batch++) {
    const lines = Array.from({ length: 500 }, (_, i) => {
      const p = products[(batch * 500 + i * 7) % products.length];
      const r = (batch + i) % 10;
      return { productId: p.id, type: r < 4 ? ("PURCHASE" as const) : ("ADJUSTMENT_IN" as const), quantity: String(1 + (i % 5)) };
    });
    await db.$transaction((tx) => postMovements(tx, ctx, lines), { timeout: 120_000 });
    posted += lines.length;
  }
  console.log(`posted ${posted} movements in ${Date.now() - t} ms`);
  console.log(`LOGIN: ${email} / perf-password-1  businessId=${businessId}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
