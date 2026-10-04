import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/common/no-access";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/ui/page-header";
import { decimalInput } from "@/lib/format";
import { listBrands } from "@/server/catalog/brands";
import { listCategories } from "@/server/catalog/categories";
import { supplierOptions } from "@/server/catalog/suppliers";
import { getProduct } from "@/server/products/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { ctx, allowed } = await pageAccess("product.write");
  if (!allowed) return <NoAccess />;
  const { id } = await params;
  const [product, categories, brands, suppliers] = await Promise.all([
    getProduct(ctx, id),
    listCategories(ctx),
    listBrands(ctx),
    supplierOptions(ctx),
  ]);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit product" subtitle={product.name} />
      <ProductForm
        mode="edit"
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        defaults={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          categoryId: product.categoryId,
          brandName: product.brand?.name,
          preferredSupplierId: product.preferredSupplierId,
          purchasePrice: decimalInput(product.purchasePrice),
          sellingPrice: decimalInput(product.sellingPrice),
          mrp: decimalInput(product.mrp),
          gstRate: decimalInput(product.gstRate),
          hsnSac: product.hsnSac,
          minStock: decimalInput(product.minStock),
          description: product.description,
          imageUrl: product.imageUrl,
          barcode: product.barcode,
        }}
      />
    </div>
  );
}
