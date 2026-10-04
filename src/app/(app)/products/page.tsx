import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus, PackageSearch, Plus } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { ProductList } from "@/components/products/product-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchBox } from "@/components/ui/search-box";
import { cn } from "@/lib/cn";
import { productListSchema } from "@/lib/validation/catalog";
import { listCategories } from "@/server/catalog/categories";
import { can } from "@/server/permissions";
import { listProducts } from "@/server/products/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Products" };

const SORT_LABELS: Record<string, string> = {
  name: "Name A–Z",
  "-createdAt": "Newest first",
  "-updatedAt": "Recently edited",
  sku: "SKU",
  sellingPrice: "Price: low to high",
  "-sellingPrice": "Price: high to low",
};

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { ctx, allowed } = await pageAccess("product.view");
  if (!allowed) return <NoAccess />;
  const raw = await searchParams;
  const query = productListSchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [data, categories] = await Promise.all([listProducts(ctx, query), listCategories(ctx)]);
  const canWrite = can(ctx, "product.write");
  const filtersActive = Boolean(query.q || query.category || query.status !== "active");

  const linkWith = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q: query.q, category: query.category, status: query.status === "active" ? undefined : query.status, sort: query.sort === "name" ? undefined : query.sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/products${sp.size ? `?${sp}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn("inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium", active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-muted");

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${data.total} ${data.total === 1 ? "product" : "products"}`}
        actions={canWrite ? <ButtonLink href="/products/new" size="md"><Plus className="size-5" aria-hidden /> Add</ButtonLink> : null}
      />
      <div className="space-y-3">
        <SearchBox placeholder="Search name, SKU, barcode, brand…" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={linkWith({ category: undefined })} className={chip(!query.category)}>All</Link>
          {categories.map((c) => (
            <Link key={c.id} href={linkWith({ category: c.id })} className={chip(query.category === c.id)}>
              {c.name}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/products">
          {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
          {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
          <label className="sr-only" htmlFor="sort">Sort</label>
          <select id="sort" name="sort" defaultValue={query.sort} className="h-10 rounded-lg border border-line bg-surface px-3">
            {Object.entries(SORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="sr-only" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={query.status} className="h-10 rounded-lg border border-line bg-surface px-3">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <button type="submit" className="h-10 rounded-lg border border-line bg-surface px-4 font-semibold">Apply</button>
        </form>
      </div>

      <div className="mt-4">
        {data.rows.length === 0 ? (
          filtersActive ? (
            <EmptyState icon={PackageSearch} title="No matching products" description="Try a different search or clear the filters."
              action={<ButtonLink href="/products" variant="secondary">Clear filters</ButtonLink>} />
          ) : (
            <EmptyState icon={PackagePlus} title="No products yet" description="Add your first product to start tracking stock."
              action={canWrite ? <ButtonLink href="/products/new">Add product</ButtonLink> : undefined} />
          )
        ) : (
          <>
            <ProductList rows={data.rows} canPrint={can(ctx, "label.print")} />
            <Pagination page={data.page} pageCount={data.pageCount} basePath="/products"
              params={{ q: query.q, category: query.category, status: query.status === "active" ? undefined : query.status, sort: query.sort === "name" ? undefined : query.sort }} />
          </>
        )}
      </div>
    </>
  );
}
