import { NextResponse } from "next/server";
import { csvRow, CSV_BOM } from "@/lib/csv";
import { businessDateKey } from "@/lib/time";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { logError } from "@/server/log";
import { can } from "@/server/permissions";
import { getTenantContext } from "@/server/tenancy/context";

/**
 * Exports all products (active and archived) with current stock.
 * Columns match the import template, so the file can be edited and re-imported into another shop.
 */
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!can(ctx, "product.export")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  await writeAudit(db, { businessId: ctx.businessId, userId: ctx.userId, action: "products.exported", entityType: "Product" });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(enc.encode(CSV_BOM));
        controller.enqueue(enc.encode(csvRow(["Product Name", "SKU", "Barcode", "Category", "Brand", "Unit", "Purchase Price", "Selling Price", "MRP", "GST Rate", "HSN", "Minimum Stock", "Current Stock", "Status", "Description"])));
        let cursor: string | undefined;
        for (;;) {
          const batch = await db.product.findMany({
            where: { businessId: ctx.businessId },
            orderBy: { id: "asc" },
            take: 1000,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: {
              category: { select: { name: true } },
              brand: { select: { name: true } },
              barcodes: { select: { code: true } },
              balances: { select: { quantity: true } },
            },
          });
          if (!batch.length) break;
          for (const p of batch) {
            const stock = p.balances.reduce((s, b) => s + Number(b.quantity), 0);
            controller.enqueue(
              enc.encode(
                csvRow([p.name, p.sku, p.barcodes[0]?.code ?? "", p.category?.name ?? "", p.brand?.name ?? "", p.unit, p.purchasePrice, p.sellingPrice, p.mrp ?? "", p.gstRate, p.hsnSac ?? "", p.minStock, stock, p.archivedAt ? "Archived" : "Active", p.description ?? ""]),
              ),
            );
          }
          cursor = batch[batch.length - 1].id;
        }
        controller.close();
      } catch (e) {
        logError("products.export", e);
        controller.error(e);
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${businessDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
