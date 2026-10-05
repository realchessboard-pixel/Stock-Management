import { Package } from "lucide-react";
import { StockBadge } from "@/components/ui/badge";
import { formatMoney, formatQty } from "@/lib/format";
import type { ProductSummary } from "@/server/products/summary";

/** Compact product header used on scan, receive, stock-out and adjust screens. */
export function ProductCard({ product, priceLabel = "Selling price", price }: { product: ProductSummary; priceLabel?: string; price?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
      <div className="flex gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas text-ink-faint">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <Package className="size-6" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-tight">{product.name}</p>
          <p className="truncate font-mono text-sm text-ink-muted">
            {product.sku}
            {product.barcode && product.barcode !== product.sku ? ` · ${product.barcode}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Available</p>
          <p className="text-3xl font-bold leading-none">
            {formatQty(product.onHand)} <span className="text-base font-medium text-ink-muted">{product.unit}</span>
          </p>
          <div className="mt-1.5">
            <StockBadge status={product.status} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{priceLabel}</p>
          <p className="text-xl font-bold">{formatMoney(price ?? product.sellingPrice)}</p>
        </div>
      </div>
    </div>
  );
}
