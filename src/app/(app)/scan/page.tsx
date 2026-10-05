import type { Metadata } from "next";
import { NoAccess } from "@/components/common/no-access";
import { ScanScreen } from "@/components/scan/scan-screen";
import { PageHeader } from "@/components/ui/page-header";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Scan barcode" };

export default async function ScanPage() {
  const { ctx, allowed } = await pageAccess("stock.scan");
  if (!allowed) return <NoAccess />;
  return (
    <>
      <PageHeader title="Scan barcode" subtitle="Scan with the camera, a scanner gun, or type the code." />
      <ScanScreen role={ctx.role} />
    </>
  );
}
