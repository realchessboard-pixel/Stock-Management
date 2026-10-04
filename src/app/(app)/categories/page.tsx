import type { Metadata } from "next";
import { CategoryManager } from "@/components/catalog/category-manager";
import { NoAccess } from "@/components/common/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { listCategories } from "@/server/catalog/categories";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { ctx, allowed } = await pageAccess("category.write");
  if (!allowed) return <NoAccess />;
  const categories = await listCategories(ctx);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Categories" subtitle="Group products the way your shop is organised." />
      <CategoryManager categories={categories} />
    </div>
  );
}
