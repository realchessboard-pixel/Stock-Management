import { Download, SlidersHorizontal } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { selectClasses } from "@/components/ui/select";
import { inputClasses } from "@/components/ui/field";
import { MOVEMENT_LABEL, MOVEMENT_TYPES } from "@/lib/movements";
import type { MovementFilter } from "@/lib/validation/reports";

/**
 * Plain GET form (works without JavaScript; URLs are shareable).
 * Collapsed on phones, showing how many filters are active.
 */
export function MovementFilters({
  action,
  filter,
  users,
  locations,
  showSearch,
  exportHref,
}: {
  action: string;
  filter: MovementFilter;
  users: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  showSearch: boolean;
  exportHref?: string;
}) {
  const active = [filter.type, filter.userId, filter.locationId, filter.from, filter.to, filter.direction].filter(Boolean).length;
  return (
    <div className="mb-4 space-y-3">
      <details className="group rounded-[var(--radius-card)] border border-line bg-surface shadow-sm" open={active > 0 || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold">
          <SlidersHorizontal className="size-5 text-ink-muted" aria-hidden />
          Filters {active ? <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{active}</span> : null}
        </summary>
        <form action={action} className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
          {filter.productId ? <input type="hidden" name="productId" value={filter.productId} /> : null}
          {showSearch ? (
            <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-3">
              Product
              <input name="q" defaultValue={filter.q} placeholder="Name, SKU or barcode" className={inputClasses} />
            </label>
          ) : null}
          <label className="space-y-1 text-sm font-medium">
            From
            <input type="date" name="from" defaultValue={filter.from} className={inputClasses} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            To
            <input type="date" name="to" defaultValue={filter.to} className={inputClasses} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Movement type
            <select name="type" defaultValue={filter.type ?? ""} className={selectClasses}>
              <option value="">All types</option>
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            In / out
            <select name="direction" defaultValue={filter.direction ?? ""} className={selectClasses}>
              <option value="">Both</option>
              <option value="IN">Stock in (+)</option>
              <option value="OUT">Stock out (−)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            User
            <select name="userId" defaultValue={filter.userId ?? ""} className={selectClasses}>
              <option value="">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Location
            <select name="locationId" defaultValue={filter.locationId ?? ""} className={selectClasses}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className={buttonClasses("primary", "md", "flex-1")}>Apply</button>
            <a href={filter.productId ? `${action}` : action} className={buttonClasses("secondary", "md")}>Clear</a>
          </div>
        </form>
      </details>
      {exportHref ? (
        <a href={exportHref} className={buttonClasses("ghost", "md")} download>
          <Download className="size-4" aria-hidden /> Export CSV
        </a>
      ) : null}
    </div>
  );
}

/** Builds a query string from a filter (drops empty values and page). */
export function filterQuery(filter: Partial<MovementFilter>, extra: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filter, ...extra })) {
    if (v !== undefined && v !== "" && k !== "page") sp.set(k, String(v));
  }
  return sp.toString();
}
