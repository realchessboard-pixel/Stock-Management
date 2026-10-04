import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/coming-soon";
import { NoAccess } from "@/components/common/no-access";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Scan barcode" };

export default async function Page() {
  const { allowed } = await pageAccess("stock.scan");
  if (!allowed) return <NoAccess />;
  return <ComingSoon title="Scan barcode" />;
}
