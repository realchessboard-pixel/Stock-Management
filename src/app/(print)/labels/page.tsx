import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { LabelSheet, type LabelItem } from "@/components/labels/label-sheet";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { parseLabelItems } from "@/lib/labels";
import { renderBarcodeSvg } from "@/server/barcodes";
import { db } from "@/server/db";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Print labels" };

export default async function LabelsPage({ searchParams }: PageProps<"/labels">) {
  const { ctx, allowed } = await pageAccess("label.print");
  if (!allowed) return <div className="p-4"><NoAccess /></div>;
  const { items } = await searchParams;
  const requested = parseLabelItems(typeof items === "string" ? items : undefined);

  const products = requested.length
    ? await db.product.findMany({
        where: { businessId: ctx.businessId, id: { in: requested.map((r) => r.id) } },
        select: { id: true, name: true, sku: true, sellingPrice: true, mrp: true, barcodes: { select: { code: true } } },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const labelItems: LabelItem[] = [];
  const withoutBarcode: string[] = [];
  for (const r of requested) {
    const p = byId.get(r.id);
    if (!p) continue;
    const code = p.barcodes[0]?.code;
    if (!code) {
      withoutBarcode.push(p.name);
      continue;
    }
    labelItems.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.sellingPrice.toString(),
      mrp: p.mrp?.toString() ?? null,
      code,
      svg: renderBarcodeSvg(code, { includeText: true, height: 10 }),
      qty: r.qty,
    });
  }

  if (labelItems.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-4 pt-10">
        <EmptyState
          icon={Tags}
          title="Nothing to print"
          description={
            withoutBarcode.length
              ? `These products have no barcode yet: ${withoutBarcode.join(", ")}. Edit them to generate one.`
              : "Choose products from the product list, then tap “Print labels”."
          }
          action={<ButtonLink href="/products">Go to products</ButtonLink>}
        />
      </div>
    );
  }

  return <LabelSheet items={labelItems} businessName={ctx.businessName} skipped={withoutBarcode} />;
}
