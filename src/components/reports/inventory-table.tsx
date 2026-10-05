import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { StockBadge } from "@/components/ui/badge";
import { formatMoney, formatQty } from "@/lib/format";
import type { InventoryRow } from "@/server/reports/inventory";

export function InventoryTable({ rows, showShortage, canReceive }: { rows: InventoryRow[]; showShortage?: boolean; canReceive?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
      <ul className="divide-y divide-line lg:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/products/${r.id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="truncate text-sm text-ink-muted">
                {r.sku}
                {r.minStock > 0 ? ` · min ${formatQty(r.minStock)}` : ""}
              </p>
              <div className="mt-1">
                <StockBadge status={r.status} />
              </div>
            </Link>
            <div className="text-right">
              <p className="text-xl font-bold">{formatQty(r.qty)}</p>
              <p className="text-xs text-ink-muted">{r.unit}</p>
            </div>
            {canReceive ? (
              <Link href={`/receive?product=${r.id}`} aria-label={`Receive ${r.name}`} className="flex size-12 items-center justify-center rounded-xl bg-ok-600 text-white">
                <ArrowDownToLine className="size-5" aria-hidden />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-2">Product</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">In stock</th>
            <th className="px-4 py-2 text-right">Minimum</th>
            {showShortage ? <th className="px-4 py-2 text-right">Need</th> : <th className="px-4 py-2 text-right">Value (cost)</th>}
            <th className="px-4 py-2">Status</th>
            {canReceive ? <th className="px-4 py-2"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-canvas">
              <td className="max-w-72 px-4 py-2.5">
                <Link href={`/products/${r.id}`} className="block truncate font-medium text-brand-700 hover:underline">{r.name}</Link>
                <span className="font-mono text-xs text-ink-muted">{r.sku}</span>
              </td>
              <td className="px-4 py-2.5 text-ink-muted">{r.category ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold">
                {formatQty(r.qty)} <span className="font-normal text-ink-muted">{r.unit}</span>
              </td>
              <td className="px-4 py-2.5 text-right text-ink-muted">{r.minStock > 0 ? formatQty(r.minStock) : "—"}</td>
              {showShortage ? (
                <td className="px-4 py-2.5 text-right font-semibold">{r.shortage > 0 ? formatQty(r.shortage) : "—"}</td>
              ) : (
                <td className="px-4 py-2.5 text-right">{formatMoney(Math.max(0, r.value))}</td>
              )}
              <td className="px-4 py-2.5"><StockBadge status={r.status} /></td>
              {canReceive ? (
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/receive?product=${r.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-ok-600 px-3 text-xs font-semibold text-white">
                    <ArrowDownToLine className="size-4" aria-hidden /> Receive
                  </Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
