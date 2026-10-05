import type { Metadata } from "next";
import { NoAccess } from "@/components/common/no-access";
import { InventoryView } from "@/components/reports/inventory-view";
import { PageHeader } from "@/components/ui/page-header";
import { flatParams, inventoryFilterSchema } from "@/lib/validation/reports";
import { locationOptions } from "@/server/locations/options";
import { can } from "@/server/permissions";
import { listInventory } from "@/server/reports/inventory";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const { ctx, allowed } = await pageAccess("product.view");
  if (!allowed) return <NoAccess />;
  const filter = inventoryFilterSchema.parse(flatParams(await searchParams));
  const [data, locations] = await Promise.all([listInventory(ctx, filter), locationOptions(ctx)]);
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock on hand for every product." />
      <InventoryView basePath="/inventory" variant="inventory" filter={filter} data={data} locations={locations}
        canReceive={can(ctx, "stock.receive")} defaultStatus="all" defaultSort="name" />
    </>
  );
}
