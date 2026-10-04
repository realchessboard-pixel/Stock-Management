import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Download, History, Package, Pencil, Printer, SlidersHorizontal } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { ArchiveButton } from "@/components/products/archive-button";
import { BarcodeImage } from "@/components/products/barcode-image";
import { Alert } from "@/components/ui/alert";
import { Badge, StockBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney, formatQty } from "@/lib/format";
import { can } from "@/server/permissions";
import { getProduct } from "@/server/products/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Product" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const { ctx, allowed } = await pageAccess("product.view");
  if (!allowed) return <NoAccess />;
  const { id } = await params;
  const { saved } = await searchParams;
  const p = await getProduct(ctx, id);
  if (!p) notFound();
  const archived = p.archivedAt !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {saved === "created" ? <Alert tone="success">Product saved.{p.barcode ? " Print a label to stick on the shelf or items." : ""}</Alert> : null}
      {saved === "updated" ? <Alert tone="success">Changes saved.</Alert> : null}
      {archived ? <Alert tone="info">This product is archived. It is hidden from lists and scanning.</Alert> : null}

      <div className="flex items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface text-ink-faint">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-8" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{p.name}</h1>
          <p className="mt-1 font-mono text-sm text-ink-muted">{p.sku}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StockBadge status={p.status} />
            {p.category ? <Badge>{p.category.name}</Badge> : null}
            {p.brand ? <Badge tone="brand">{p.brand.name}</Badge> : null}
          </div>
        </div>
      </div>

      <Card className="flex items-end justify-between">
        <div>
          <p className="text-sm text-ink-muted">In stock</p>
          <p className="text-4xl font-bold">
            {formatQty(p.onHand)} <span className="text-lg font-medium text-ink-muted">{p.unit}</span>
          </p>
          {Number(p.minStock) > 0 ? <p className="text-sm text-ink-muted">Minimum: {formatQty(p.minStock)}</p> : null}
        </div>
        <p className="text-right">
          <span className="block text-sm text-ink-muted">Selling price</span>
          <span className="text-2xl font-bold">{formatMoney(p.sellingPrice)}</span>
        </p>
      </Card>

      {!archived ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {can(ctx, "stock.receive") ? (
            <ButtonLink href={`/receive?product=${p.id}`} variant="success"><ArrowDownToLine className="size-5" aria-hidden /> Receive</ButtonLink>
          ) : null}
          {can(ctx, "stock.out") ? (
            <ButtonLink href={`/stock-out?product=${p.id}`} className="bg-warn-600 hover:bg-warn-600/90"><ArrowUpFromLine className="size-5" aria-hidden /> Stock out</ButtonLink>
          ) : null}
          {can(ctx, "stock.adjust") ? (
            <ButtonLink href={`/adjust?product=${p.id}`} variant="secondary"><SlidersHorizontal className="size-5" aria-hidden /> Adjust</ButtonLink>
          ) : null}
          {can(ctx, "stock.ledger") ? (
            <ButtonLink href={`/products/${p.id}/ledger`} variant="secondary"><History className="size-5" aria-hidden /> Ledger</ButtonLink>
          ) : null}
        </div>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Barcode</h2>
          {p.barcode ? <Badge>{p.barcode.kind === "GENERATED" ? "Code 128 · generated" : "Manufacturer"}</Badge> : null}
        </div>
        {p.barcode ? (
          <>
            <div className="flex justify-center rounded-xl border border-line bg-white p-4">
              <BarcodeImage code={p.barcode.code} className="w-full max-w-xs [&_svg]:h-auto [&_svg]:w-full" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {can(ctx, "label.print") ? (
                <Link href={`/labels?items=${p.id}:1`} className={buttonClasses("primary", "lg")}>
                  <Printer className="size-5" aria-hidden /> Print labels
                </Link>
              ) : null}
              <a href={`/api/products/${p.id}/barcode`} download className={buttonClasses("secondary", "lg")}>
                <Download className="size-5" aria-hidden /> Download
              </a>
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-muted">
            No barcode yet.{" "}
            {can(ctx, "product.write") ? (
              <Link href={`/products/${p.id}/edit`} className="font-semibold text-brand-700 underline">Add or generate one</Link>
            ) : null}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Details</h2>
        <dl className="divide-y divide-line text-sm">
          <Row label="Purchase price" value={formatMoney(p.purchasePrice, true)} />
          <Row label="Selling price" value={formatMoney(p.sellingPrice, true)} />
          <Row label="MRP" value={p.mrp ? formatMoney(p.mrp, true) : "—"} />
          <Row label="GST" value={`${Number(p.gstRate)}%`} />
          <Row label="HSN / SAC" value={p.hsnSac ?? "—"} />
          <Row label="Unit" value={p.unit} />
          <Row label="Preferred supplier" value={p.preferredSupplier ? <Link className="text-brand-700 underline" href={`/suppliers/${p.preferredSupplier.id}`}>{p.preferredSupplier.name}</Link> : "—"} />
          {p.balances.length > 1
            ? p.balances.map((b) => <Row key={b.location.id} label={`Stock at ${b.location.name}`} value={formatQty(b.quantity)} />)
            : null}
        </dl>
        {p.description ? <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">{p.description}</p> : null}
      </Card>

      {can(ctx, "product.write") ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ButtonLink href={`/products/${p.id}/edit`} variant="secondary" size="md"><Pencil className="size-4" aria-hidden /> Edit product</ButtonLink>
          <ArchiveButton id={p.id} archived={archived} />
        </div>
      ) : null}
    </div>
  );
}
