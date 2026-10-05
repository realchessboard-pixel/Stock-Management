import type { Metadata } from "next";
import { AdjustForm } from "@/components/stock/adjust-form";
import { StockOperationPage } from "@/components/stock/stock-page";
import { Alert } from "@/components/ui/alert";
import { locationOptions } from "@/server/locations/options";

export const metadata: Metadata = { title: "Adjust stock" };

export default function AdjustPage({ searchParams }: PageProps<"/adjust">) {
  return (
    <StockOperationPage
      title="Adjust stock"
      pickTitle="Record damage, loss, returns or a stock count."
      basePath="/adjust"
      permission="stock.adjust"
      searchParams={searchParams}
      render={async ({ ctx, product, idempotencyKey }) => {
        if (product.archived) return <Alert tone="info">This product is archived. Restore it before adjusting stock.</Alert>;
        return <AdjustForm product={product} idempotencyKey={idempotencyKey} locations={await locationOptions(ctx)} />;
      }}
    />
  );
}
