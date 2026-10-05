import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { NoAccess } from "@/components/common/no-access";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { listBrands } from "@/server/catalog/brands";
import { listCategories } from "@/server/catalog/categories";
import { supplierOptions } from "@/server/catalog/suppliers";
import { locationOptions } from "@/server/locations/options";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const { ctx, allowed } = await pageAccess("product.write");
  if (!allowed) return <NoAccess />;
  const { barcode } = await searchParams;
  const [categories, brands, suppliers, locations] = await Promise.all([listCategories(ctx), listBrands(ctx), supplierOptions(ctx), locationOptions(ctx)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add product" />
      <ProductForm
        mode="create"
        // A fresh key per page render makes the Save button safe to double-tap.
        idempotencyKey={randomUUID()}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        locations={locations}
        initialBarcode={typeof barcode === "string" ? barcode.slice(0, 48) : undefined}
      />
    </div>
  );
}
