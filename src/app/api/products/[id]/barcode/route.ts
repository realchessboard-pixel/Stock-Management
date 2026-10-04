import { NextResponse } from "next/server";
import { renderBarcodePng } from "@/server/barcodes";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { getTenantContext } from "@/server/tenancy/context";

/** Downloads a product's barcode as PNG. Tenant-scoped; 404 for other shops' products. */
export async function GET(_req: Request, { params }: RouteContext<"/api/products/[id]/barcode">) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!can(ctx, "product.view")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  const barcode = await db.barcode.findFirst({
    where: { productId: id, businessId: ctx.businessId },
    select: { code: true, product: { select: { sku: true } } },
  });
  if (!barcode) return NextResponse.json({ error: "No barcode for this product." }, { status: 404 });
  const png = await renderBarcodePng(barcode.code);
  const filename = `${barcode.product.sku}-${barcode.code}.png`.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
