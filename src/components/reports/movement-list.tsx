import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime, formatQty, formatSignedQty } from "@/lib/format";
import { MOVEMENT_LABEL } from "@/lib/movements";
import type { MovementRow } from "@/server/reports/movements";

/**
 * Stock ledger rows. Direction is shown by sign (+/−) AND colour, never
 * colour alone. `showProduct` is off on a single product's ledger.
 */
export function MovementList({ rows, showProduct }: { rows: MovementRow[]; showProduct: boolean }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
      {/* Phone layout */}
      <ul className="divide-y divide-line lg:hidden">
        {rows.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{MOVEMENT_LABEL[m.type]}</p>
              {showProduct ? (
                <Link href={`/products/${m.product.id}`} className="block truncate text-sm text-brand-700">
                  {m.product.name}
                </Link>
              ) : null}
              <p className="truncate text-xs text-ink-muted">
                {formatDateTime(m.createdAt)} · {m.user.name}
                {m.reason ? ` · ${m.reason}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className={cn("text-lg font-bold", m.direction === "IN" ? "text-ok-700" : "text-danger-700")}>
                {formatSignedQty(m.quantity, m.direction)}
              </p>
              <p className="text-xs text-ink-muted">
                Bal {formatQty(m.newBalance)} {m.product.unit}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {/* Desktop table */}
      <table className="hidden w-full text-sm lg:table">
        <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Movement</th>
            {showProduct ? <th className="px-4 py-2">Product</th> : null}
            <th className="px-4 py-2 text-right">Qty</th>
            <th className="px-4 py-2 text-right">Balance</th>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Location</th>
            <th className="px-4 py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((m) => (
            <tr key={m.id} className="hover:bg-canvas">
              <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{formatDateTime(m.createdAt)}</td>
              <td className="px-4 py-2.5 font-medium">{MOVEMENT_LABEL[m.type]}</td>
              {showProduct ? (
                <td className="max-w-64 truncate px-4 py-2.5">
                  <Link href={`/products/${m.product.id}`} className="text-brand-700 hover:underline">
                    {m.product.name}
                  </Link>
                </td>
              ) : null}
              <td className={cn("whitespace-nowrap px-4 py-2.5 text-right font-bold", m.direction === "IN" ? "text-ok-700" : "text-danger-700")}>
                {formatSignedQty(m.quantity, m.direction)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                {formatQty(m.newBalance)} <span className="text-ink-muted">{m.product.unit}</span>
              </td>
              <td className="px-4 py-2.5">{m.user.name}</td>
              <td className="px-4 py-2.5 text-ink-muted">{m.location.name}</td>
              <td className="max-w-48 truncate px-4 py-2.5 text-ink-muted" title={m.reason ?? undefined}>
                {m.reason ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
