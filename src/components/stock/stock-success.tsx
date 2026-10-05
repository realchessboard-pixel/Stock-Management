"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { formatQty } from "@/lib/format";
import type { StockResult } from "@/server/inventory/operations";

/** Big, unmistakable confirmation after a stock change. */
export function StockSuccess({ title, result, sign, actions }: { title: string; result: StockResult; sign: "+" | "−"; actions: ReactNode }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="rounded-[var(--radius-card)] border border-ok-600/30 bg-ok-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok-600" aria-hidden />
        <p className="mt-2 text-xl font-bold text-ok-700">{title}</p>
        <p className="mt-1 text-base font-semibold">{result.productName}</p>
        <p className="mt-3 text-4xl font-bold">
          {sign}
          {formatQty(result.quantity)} <span className="text-lg font-medium text-ink-muted">{result.unit}</span>
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Stock: {formatQty(result.previousBalance)} → <span className="font-bold text-ink">{formatQty(result.newBalance)}</span> {result.unit}
        </p>
      </div>
      <div className="grid gap-3">{actions}</div>
      <Link href={`/products/${result.productId}`} className={buttonClasses("ghost", "md", "w-full")}>
        View product
      </Link>
    </div>
  );
}
