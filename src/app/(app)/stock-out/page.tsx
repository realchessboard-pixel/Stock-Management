import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/coming-soon";
import { NoAccess } from "@/components/common/no-access";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Stock out" };

export default async function Page() {
  const { allowed } = await pageAccess("stock.out");
  if (!allowed) return <NoAccess />;
  return <ComingSoon title="Stock out" />;
}
