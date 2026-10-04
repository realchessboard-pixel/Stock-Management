import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Truck } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchBox } from "@/components/ui/search-box";
import { listSuppliers } from "@/server/catalog/suppliers";
import { can } from "@/server/permissions";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  const { ctx, allowed } = await pageAccess("supplier.view");
  if (!allowed) return <NoAccess />;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const showInactive = sp.inactive === "1";
  const data = await listSuppliers(ctx, { q, page, includeInactive: showInactive });
  const canWrite = can(ctx, "supplier.write");

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={`${data.total} ${data.total === 1 ? "supplier" : "suppliers"}`}
        actions={canWrite ? <ButtonLink href="/suppliers/new" size="md"><Plus className="size-5" aria-hidden /> Add</ButtonLink> : null}
      />
      <SearchBox placeholder="Search name, company, phone, GSTIN…" />
      <div className="mt-2 text-right text-sm">
        <Link href={showInactive ? "/suppliers" : "/suppliers?inactive=1"} className="font-medium text-brand-700 underline">
          {showInactive ? "Hide inactive" : "Show inactive"}
        </Link>
      </div>
      <div className="mt-3">
        {data.rows.length === 0 ? (
          <EmptyState icon={Truck} title={q ? "No matching suppliers" : "No suppliers yet"}
            description={q ? "Try a different search." : "Add the people and companies you buy stock from."}
            action={canWrite && !q ? <ButtonLink href="/suppliers/new">Add supplier</ButtonLink> : undefined} />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
            {data.rows.map((s) => (
              <li key={s.id}>
                <Link href={`/suppliers/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {s.name} {!s.isActive ? <Badge className="ml-1">Inactive</Badge> : null}
                    </p>
                    <p className="truncate text-sm text-ink-muted">{[s.company, s.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <span className="text-sm text-ink-muted">{s._count.products} products</span>
                  <ChevronRight className="size-5 text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={data.page} pageCount={data.pageCount} basePath="/suppliers" params={{ q, inactive: showInactive ? "1" : undefined }} />
      </div>
    </>
  );
}
