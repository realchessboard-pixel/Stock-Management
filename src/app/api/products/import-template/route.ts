import { NextResponse } from "next/server";
import { importTemplateCsv } from "@/server/imports/products";
import { getTenantContext } from "@/server/tenancy/context";

export async function GET() {
  if (!(await getTenantContext())) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return new NextResponse(importTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stockflow-products-template.csv"',
    },
  });
}
