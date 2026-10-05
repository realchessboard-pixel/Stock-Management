import { NextResponse, type NextRequest } from "next/server";
import { csvRow, CSV_BOM } from "@/lib/csv";
import { MOVEMENT_LABEL } from "@/lib/movements";
import { BUSINESS_TZ, businessDateKey } from "@/lib/time";
import { flatParams, movementFilterSchema } from "@/lib/validation/reports";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { logError } from "@/server/log";
import { can } from "@/server/permissions";
import { iterateMovements } from "@/server/reports/movements";
import { getTenantContext } from "@/server/tenancy/context";

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: BUSINESS_TZ, dateStyle: "medium", timeStyle: "short" });

/** Streams the (filtered) stock ledger as CSV. */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!can(ctx, "stock.ledger")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { page: _page, ...filter } = movementFilterSchema.parse(flatParams(Object.fromEntries(req.nextUrl.searchParams)));
  void _page;
  await writeAudit(db, { businessId: ctx.businessId, userId: ctx.userId, action: "movements.exported", entityType: "StockMovement", metadata: filter });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_BOM));
        controller.enqueue(
          encoder.encode(
            csvRow(["Date", "Movement", "Product", "SKU", "Quantity", "Unit", "Balance before", "Balance after", "Unit cost", "Unit price", "Location", "User", "Reason", "Reference"]),
          ),
        );
        for await (const m of iterateMovements(ctx, filter)) {
          const signed = (m.direction === "IN" ? "" : "-") + m.quantity.toString();
          controller.enqueue(
            encoder.encode(
              csvRow([
                timeFmt.format(m.createdAt),
                MOVEMENT_LABEL[m.type],
                m.product.name,
                m.product.sku,
                signed,
                m.product.unit,
                m.previousBalance.toString(),
                m.newBalance.toString(),
                m.unitCost?.toString() ?? "",
                m.unitPrice?.toString() ?? "",
                m.location.name,
                m.user.name,
                m.reason ?? "",
                m.referenceType ? `${m.referenceType}${m.referenceId ? ` ${m.referenceId}` : ""}` : "",
              ]),
            ),
          );
        }
        controller.close();
      } catch (e) {
        logError("movements.export", e);
        controller.error(e);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-movements-${businessDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
