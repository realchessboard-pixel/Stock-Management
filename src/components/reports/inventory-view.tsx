import Link from "next/link";
import { CheckCircle2, PackageSearch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchBox } from "@/components/ui/search-box";
import { selectClasses } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { formatMoney, formatQty } from "@/lib/format";
import type { InventoryFilter } from "@/lib/validation/reports";
import type { listInventory } from "@/server/reports/inventory";
import { InventoryTable } from "./inventory-table";

type Data = Awaited<ReturnType<typeof listInventory>>;

const STATUS_CHIPS: Record<string, [InventoryFilter["status"], string][]> = {
  inventory: [
    ["all", "All"],
    ["in", "In stock"],
    ["low", "Low"],
    ["out", "Out"],
  ],
  lowStock: [
    ["attention", "All alerts"],
    ["low", "Low stock"],
    ["out", "Out of stock"],
  ],
};

/** Shared body of the Inventory and Low Stock screens. */
export function InventoryView({
  basePath,
  variant,
  filter,
  data,
  locations,
  canReceive,
  defaultStatus,
  defaultSort,
}: {
  basePath: string;
  variant: "inventory" | "lowStock";
  filter: InventoryFilter;
  data: Data;
  locations: { id: string; name: string }[];
  canReceive: boolean;
  defaultStatus: InventoryFilter["status"];
  defaultSort: InventoryFilter["sort"];
}) {
  const params = (patch: Partial<Record<keyof InventoryFilter, string | undefined>>) => {
    const merged: Record<string, string | undefined> = {
      q: filter.q,
      status: filter.status === defaultStatus ? undefined : filter.status,
      locationId: filter.locationId,
      sort: filter.sort === defaultSort ? undefined : filter.sort,
      ...patch,
    };
    return Object.fromEntries(Object.entries(merged).filter(([, v]) => v));
  };
  const href = (patch: Partial<Record<keyof InventoryFilter, string | undefined>>) => {
    const sp = new URLSearchParams(params(patch) as Record<string, string>);
    return `${basePath}${sp.size ? `?${sp}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn("inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-muted");

  return (
    <div className="space-y-4">
      {variant === "inventory" ? (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-sm text-ink-muted">Units in stock</p>
            <p className="text-2xl font-bold">{formatQty(data.units)}</p>
          </Card>
          <Card>
            <p className="text-sm text-ink-muted">Stock value (cost)</p>
            <p className="text-2xl font-bold">{formatMoney(data.value)}</p>
          </Card>
        </div>
      ) : null}
      <SearchBox placeholder="Search product, SKU or barcode" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {STATUS_CHIPS[variant].map(([status, label]) => (
          <Link key={status} href={href({ status: status === defaultStatus ? undefined : status, page: undefined })} className={chip(filter.status === status)}>
            {label}
          </Link>
        ))}
      </div>
      <form action={basePath} className="flex flex-wrap gap-2">
        {filter.q ? <input type="hidden" name="q" value={filter.q} /> : null}
        {filter.status !== defaultStatus ? <input type="hidden" name="status" value={filter.status} /> : null}
        {locations.length > 1 ? (
          <select name="locationId" defaultValue={filter.locationId ?? ""} aria-label="Location" className={cn(selectClasses, "h-10 w-auto")}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        ) : null}
        <select name="sort" defaultValue={filter.sort} aria-label="Sort" className={cn(selectClasses, "h-10 w-auto")}>
          <option value="shortage">Most urgent first</option>
          <option value="name">Name A–Z</option>
          <option value="qty">Lowest stock first</option>
          <option value="-qty">Highest stock first</option>
          <option value="-value">Highest value first</option>
        </select>
        <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 text-sm font-semibold">Apply</button>
      </form>

      {data.rows.length ? (
        <>
          <p className="text-sm text-ink-muted">{data.total} products</p>
          <InventoryTable rows={data.rows} showShortage={variant === "lowStock"} canReceive={canReceive} />
          <Pagination page={data.page} pageCount={data.pageCount} basePath={basePath} params={params({})} />
        </>
      ) : variant === "lowStock" && !filter.q ? (
        <EmptyState icon={CheckCircle2} title="All stocked up" description="No products are below their minimum level. Set a minimum stock on products to get alerts here." />
      ) : (
        <EmptyState icon={PackageSearch} title="No products found" description="Try a different search or filter." />
      )}
    </div>
  );
}
