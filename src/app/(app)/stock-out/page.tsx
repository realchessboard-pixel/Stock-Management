import type { Metadata } from "next";
import { StockOperationPage } from "@/components/stock/stock-page";
import { StockOutForm } from "@/components/stock/stock-out-form";
import { Alert } from "@/components/ui/alert";
import { locationOptions } from "@/server/locations/options";

export const metadata: Metadata = { title: "Stock out" };

export default function StockOutPage({ searchParams }: PageProps<"/stock-out">) {
  return (
    <StockOperationPage
      title="Stock out"
      pickTitle="Scan or search the product going out."
      basePath="/stock-out"
      permission="stock.out"
      searchParams={searchParams}
      render={async ({ ctx, product, idempotencyKey }) => {
        if (product.archived) return <Alert tone="info">This product is archived. Restore it before moving stock.</Alert>;
        const locations = await locationOptions(ctx);
        return <StockOutForm product={product} idempotencyKey={idempotencyKey} locations={locations} allowNegative={ctx.allowNegativeStock} />;
      }}
    />
  );
}
