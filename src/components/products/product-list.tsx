"use client";

import Link from "next/link";
import { useState } from "react";
import { Package, Printer, X } from "lucide-react";
import { StockBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMoney, formatQty } from "@/lib/format";
import type { StockStatus } from "@/lib/stock-status";

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  sellingPrice: string;
  imageUrl: string | null;
  archived: boolean;
  category: string | null;
  brand: string | null;
  barcode: string | null;
  onHand: number;
  status: StockStatus;
};

/**
 * Product list: cards on phones, table on desktop. "Select" mode lets the
 * user pick several products and print labels for all of them at once.
 */
export function ProductList({ rows, canPrint }: { rows: ProductRow[]; canPrint: boolean }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const labelsHref = `/labels?items=${[...selected].map((id) => `${id}:1`).join(",")}`;

  return (
    <>
      {canPrint ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelecting((s) => !s);
              setSelected(new Set());
            }}
            className={buttonClasses("ghost", "md")}
          >
            {selecting ? (
              <>
                <X className="size-4" aria-hidden /> Cancel
              </>
            ) : (
              <>
                <Printer className="size-4" aria-hidden /> Print labels
              </>
            )}
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
        <li className="hidden grid-cols-[1fr_9rem_7rem_8rem_8rem] gap-4 bg-canvas px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted lg:grid">
          <span>Product</span>
          <span>SKU / Barcode</span>
          <span className="text-right">Price</span>
          <span className="text-right">In stock</span>
          <span>Status</span>
        </li>
        {rows.map((p) => {
          const isSel = selected.has(p.id);
          const inner = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                {selecting ? (
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      isSel ? "border-brand-600 bg-brand-600 text-white" : "border-line",
                    )}
                  >
                    {isSel ? "✓" : ""}
                  </span>
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas text-ink-faint">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Package className="size-5" aria-hidden />
                    )}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="truncate text-sm text-ink-muted lg:hidden">
                    {p.sku}
                    {p.category ? ` · ${p.category}` : ""}
                  </p>
                  <p className="hidden truncate text-sm text-ink-muted lg:block">
                    {[p.category, p.brand].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <div className="hidden min-w-0 text-sm lg:block">
                <p className="truncate font-mono">{p.sku}</p>
                <p className="truncate font-mono text-ink-muted">{p.barcode ?? "No barcode"}</p>
              </div>
              <p className="hidden text-right lg:block">{formatMoney(p.sellingPrice)}</p>
              <div className="text-right">
                <p className="text-lg font-bold leading-tight lg:text-base">{formatQty(p.onHand)}</p>
                <p className="text-xs text-ink-muted">{p.unit}</p>
              </div>
              <div className="col-span-2 flex gap-2 lg:col-span-1">
                <StockBadge status={p.status} />
                {p.archived ? <span className="text-xs font-semibold text-ink-muted">ARCHIVED</span> : null}
              </div>
            </>
          );
          const cls =
            "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 lg:grid-cols-[1fr_9rem_7rem_8rem_8rem]";
          return (
            <li key={p.id}>
              {selecting ? (
                <button type="button" onClick={() => toggle(p.id)} aria-pressed={isSel} className={cn(cls, "w-full text-left", isSel && "bg-brand-50")}>
                  {inner}
                </button>
              ) : (
                <Link href={`/products/${p.id}`} className={cn(cls, "hover:bg-canvas")}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {selecting && selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-24 z-40 px-4 lg:bottom-6 lg:left-64">
          <Link href={labelsHref} className={buttonClasses("primary", "xl", "mx-auto w-full max-w-md shadow-lg")}>
            <Printer className="size-5" aria-hidden /> Print labels for {selected.size}
          </Link>
        </div>
      ) : null}
    </>
  );
}
