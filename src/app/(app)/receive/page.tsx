import type { Metadata } from "next";
import { ReceiveForm } from "@/components/stock/receive-form";
import { StockOperationPage } from "@/components/stock/stock-page";
import { Alert } from "@/components/ui/alert";
import { supplierOptions } from "@/server/catalog/suppliers";
import { locationOptions } from "@/server/locations/options";
import { can } from "@/server/permissions";

export const metadata: Metadata = { title: "Receive stock" };

export default function ReceivePage({ searchParams }: PageProps<"/receive">) {
  return (
    <StockOperationPage
      title="Receive stock"
      pickTitle="Scan or search the product you received."
      basePath="/receive"
      permission="stock.receive"
      searchParams={searchParams}
      render={async ({ ctx, product, idempotencyKey }) => {
        if (product.archived) return <Alert tone="info">This product is archived. Restore it before receiving stock.</Alert>;
        const [suppliers, locations] = await Promise.all([supplierOptions(ctx), locationOptions(ctx)]);
        return <ReceiveForm product={product} idempotencyKey={idempotencyKey} suppliers={suppliers} locations={locations} canPrint={can(ctx, "label.print")} />;
      }}
    />
  );
}
