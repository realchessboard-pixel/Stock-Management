import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/common/no-access";
import { PageHeader } from "@/components/ui/page-header";
import type { Permission } from "@/lib/permissions";
import { can } from "@/server/permissions";
import { getProduct } from "@/server/products/service";
import { toSummary, type ProductSummary } from "@/server/products/summary";
import type { TenantContext } from "@/server/tenancy/context";
import { pageAccess } from "@/server/tenancy/page-guard";
import { ProductPicker } from "./product-picker";

/**
 * Shared shell for Receive / Stock out / Adjust:
 * no ?product → product picker; with ?product → the operation form with a
 * fresh idempotency key for this render.
 */
export async function StockOperationPage({
  title,
  pickTitle,
  basePath,
  permission,
  searchParams,
  render,
}: {
  title: string;
  pickTitle: string;
  basePath: string;
  permission: Permission;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  render: (args: { ctx: TenantContext; product: ProductSummary; idempotencyKey: string }) => Promise<ReactNode> | ReactNode;
}) {
  const { ctx, allowed } = await pageAccess(permission);
  if (!allowed) return <NoAccess />;
  const { product: productId } = await searchParams;

  if (typeof productId !== "string" || !productId) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={title} subtitle={pickTitle} />
        <ProductPicker basePath={basePath} canCreate={can(ctx, "product.write")} />
      </div>
    );
  }

  const product = await getProduct(ctx, productId.slice(0, 40));
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={title} />
      {await render({ ctx, product: toSummary(product), idempotencyKey: randomUUID() })}
    </div>
  );
}
