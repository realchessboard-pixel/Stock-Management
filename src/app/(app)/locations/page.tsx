import type { Metadata } from "next";
import { LocationManager } from "@/components/admin/location-manager";
import { NoAccess } from "@/components/common/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { listLocations } from "@/server/locations/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const { ctx, allowed } = await pageAccess("location.write");
  if (!allowed) return <NoAccess />;
  const locations = await listLocations(ctx);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Locations" subtitle="Shops, godowns, racks and bins where you keep stock." />
      <LocationManager locations={locations} />
    </div>
  );
}
