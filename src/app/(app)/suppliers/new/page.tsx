import type { Metadata } from "next";
import { SupplierForm } from "@/components/catalog/supplier-form";
import { NoAccess } from "@/components/common/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Add supplier" };

export default async function NewSupplierPage() {
  const { allowed } = await pageAccess("supplier.write");
  if (!allowed) return <NoAccess />;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add supplier" />
      <SupplierForm />
    </div>
  );
}
