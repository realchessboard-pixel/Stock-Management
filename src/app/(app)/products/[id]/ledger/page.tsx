import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { filterQuery, MovementFilters } from "@/components/reports/movement-filters";
import { MovementList } from "@/components/reports/movement-list";
import { StockBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { formatQty } from "@/lib/format";
import { flatParams, movementFilterSchema } from "@/lib/validation/reports";
import { getProduct } from "@/server/products/service";
import { listMovements, movementFilterOptions } from "@/server/reports/movements";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Stock ledger" };

export default async function ProductLedgerPage({ params, searchParams }: PageProps<"/products/[id]/ledger">) {
  const { ctx, allowed } = await pageAccess("stock.ledger");
  if (!allowed) return <NoAccess />;
  const { id } = await params;
  const product = await getProduct(ctx, id);
  if (!product) notFound();
  const filter = { ...movementFilterSchema.parse(flatParams(await searchParams)), productId: id, q: undefined };
  const [data, options] = await Promise.all([listMovements(ctx, filter), movementFilterOptions(ctx)]);
  const qs = filterQuery({ ...filter, productId: undefined });

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/products/${id}`} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-700">
        <ArrowLeft className="size-4" aria-hidden /> {product.name}
      </Link>
      <h1 className="text-2xl font-bold">Stock ledger</h1>
      <Card className="my-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">Current stock</p>
          <p className="text-3xl font-bold">
            {formatQty(product.onHand)} <span className="text-base font-medium text-ink-muted">{product.unit}</span>
          </p>
        </div>
        <StockBadge status={product.status} />
      </Card>
      <MovementFilters
        action={`/products/${id}/ledger`}
        filter={filter}
        users={options.users}
        locations={options.locations}
        showSearch={false}
        exportHref={`/api/movements/export?${filterQuery(filter)}`}
      />
      {data.rows.length ? (
        <>
          <p className="mb-2 text-sm text-ink-muted">{data.total} movements</p>
          <MovementList rows={data.rows} showProduct={false} />
          <Pagination page={data.page} pageCount={data.pageCount} basePath={`/products/${id}/ledger`} params={Object.fromEntries(new URLSearchParams(qs))} />
        </>
      ) : (
        <EmptyState icon={History} title="No movements" description="Stock changes for this product will appear here." />
      )}
    </div>
  );
}
