import type { Metadata } from "next";
import { NoAccess } from "@/components/common/no-access";
import { InventoryView } from "@/components/reports/inventory-view";
import { PageHeader } from "@/components/ui/page-header";
import { flatParams, inventoryFilterSchema } from "@/lib/validation/reports";
import { locationOptions } from "@/server/locations/options";
import { can } from "@/server/permissions";
import { listInventory } from "@/server/reports/inventory";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Low stock" };

export default async function LowStockPage({ searchParams }: PageProps<"/low-stock">) {
  const { ctx, allowed } = await pageAccess("product.view");
  if (!allowed) return <NoAccess />;
  const raw = flatParams(await searchParams);
  const filter = inventoryFilterSchema.parse({ status: "attention", sort: "shortage", ...raw });
  const [data, locations] = await Promise.all([listInventory(ctx, filter), locationOptions(ctx)]);
  return (
    <>
      <PageHeader title="Low stock" subtitle="Products below their minimum level or out of stock." />
      <InventoryView basePath="/low-stock" variant="lowStock" filter={filter} data={data} locations={locations}
        canReceive={can(ctx, "stock.receive")} defaultStatus="attention" defaultSort="shortage" />
    </>
  );
}
