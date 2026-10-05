import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { NoAccess } from "@/components/common/no-access";
import { ImportWizard } from "@/components/imports/import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportPage() {
  const { allowed } = await pageAccess("product.import");
  if (!allowed) return <NoAccess />;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Import products" subtitle="Add many products at once from Excel or CSV." />
      <ImportWizard idempotencyKey={randomUUID()} />
    </div>
  );
}
