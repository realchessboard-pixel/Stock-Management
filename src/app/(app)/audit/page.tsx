import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { NoAccess } from "@/components/common/no-access";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { inputClasses } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { selectClasses } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { flatParams } from "@/lib/validation/reports";
import { listAuditLogs } from "@/server/reports/audit";
import { movementFilterOptions } from "@/server/reports/movements";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Audit log" };

const AREAS: Record<string, string> = {
  "stock.": "Stock",
  "product": "Products",
  "user.": "Users & logins",
  "supplier.": "Suppliers",
  "category.": "Categories",
  "location.": "Locations",
  "business.": "Shop settings",
};

function describe(action: string) {
  return action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function summary(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  if (m.changed && typeof m.changed === "object") return `Changed: ${Object.keys(m.changed).join(", ")}`;
  const parts = ["name", "quantity", "newBalance", "reason", "role", "from", "to", "created"]
    .filter((k) => m[k] !== undefined && m[k] !== null)
    .map((k) => `${k}: ${String(m[k])}`);
  return parts.join(" · ");
}

const dateKey = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const { ctx, allowed } = await pageAccess("audit.view");
  if (!allowed) return <NoAccess />;
  const sp = flatParams(await searchParams);
  const filter = {
    action: typeof sp.action === "string" && sp.action in AREAS ? sp.action : undefined,
    userId: typeof sp.userId === "string" && /^c[a-z0-9]{20,30}$/.test(sp.userId) ? sp.userId : undefined,
    from: dateKey(sp.from),
    to: dateKey(sp.to),
    page: Math.max(1, Number(sp.page) || 1),
  };
  const [data, { users }] = await Promise.all([listAuditLogs(ctx, filter), movementFilterOptions(ctx)]);

  return (
    <>
      <PageHeader title="Audit log" subtitle="A permanent record of important actions. It can't be edited." />
      <form action="/audit" className="mb-4 grid gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <select name="action" defaultValue={filter.action ?? ""} className={selectClasses} aria-label="Area">
          <option value="">All areas</option>
          {Object.entries(AREAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="userId" defaultValue={filter.userId ?? ""} className={selectClasses} aria-label="User">
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={filter.from} className={inputClasses} aria-label="From date" />
        <input type="date" name="to" defaultValue={filter.to} className={inputClasses} aria-label="To date" />
        <button type="submit" className={buttonClasses("primary", "md")}>Filter</button>
      </form>
      {data.rows.length ? (
        <>
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
            {data.rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{describe(r.action)}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(r.createdAt)}</p>
                </div>
                <p className="text-sm text-ink-muted">
                  {r.user?.name ?? "System"} · {r.entityType}
                </p>
                {summary(r.metadata) ? <p className="mt-0.5 break-words text-sm">{summary(r.metadata)}</p> : null}
                {r.metadata ? (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-brand-700">Details</summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-canvas p-2">{JSON.stringify(r.metadata, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageCount={data.pageCount} basePath="/audit" params={{ action: filter.action, userId: filter.userId, from: filter.from, to: filter.to }} />
        </>
      ) : (
        <EmptyState icon={ShieldCheck} title="No matching entries" />
      )}
    </>
  );
}
