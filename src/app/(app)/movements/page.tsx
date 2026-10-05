import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { filterQuery, MovementFilters } from "@/components/reports/movement-filters";
import { MovementList } from "@/components/reports/movement-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { flatParams, movementFilterSchema } from "@/lib/validation/reports";
import { can } from "@/server/permissions";
import { listMovements, movementFilterOptions } from "@/server/reports/movements";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Stock movements" };

export default async function MovementsPage({ searchParams }: PageProps<"/movements">) {
  const { ctx, allowed } = await pageAccess("product.view");
  if (!allowed) return <NoAccess />;
  const filter = movementFilterSchema.parse(flatParams(await searchParams));
  // Staff see only their own movements; the full ledger needs stock.ledger.
  const fullLedger = can(ctx, "stock.ledger");
  const effective = fullLedger ? filter : { ...filter, userId: ctx.userId };
  const [data, options] = await Promise.all([listMovements(ctx, effective), movementFilterOptions(ctx)]);
  const qs = filterQuery(filter);

  return (
    <>
      <PageHeader title="Stock movements" subtitle={fullLedger ? "Every stock change, newest first." : "Your recent stock changes."} />
      {fullLedger ? (
        <MovementFilters
          action="/movements"
          filter={filter}
          users={options.users}
          locations={options.locations}
          showSearch
          exportHref={`/api/movements/export?${qs}`}
        />
      ) : null}
      {data.rows.length ? (
        <>
          <p className="mb-2 text-sm text-ink-muted">{data.total} movements</p>
          <MovementList rows={data.rows} showProduct />
          <Pagination page={data.page} pageCount={data.pageCount} basePath="/movements" params={Object.fromEntries(new URLSearchParams(qs))} />
        </>
      ) : (
        <EmptyState icon={ArrowLeftRight} title="No stock movements" description="Receive, sell or adjust stock and it will show up here." />
      )}
    </>
  );
}
