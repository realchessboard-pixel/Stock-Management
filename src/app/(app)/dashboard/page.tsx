import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  PackagePlus,
  PackageX,
  ScanBarcode,
  type LucideIcon,
} from "lucide-react";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { InOutChart } from "@/components/reports/in-out-chart";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatQty, formatSignedQty } from "@/lib/format";
import { MOVEMENT_LABEL } from "@/lib/movements";
import { roleCan, type Permission } from "@/lib/permissions";
import { getOnboardingProgress } from "@/server/onboarding/progress";
import { getDashboard } from "@/server/reports/dashboard";
import { requirePageContext } from "@/server/tenancy/context";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; tone: string; permission: Permission }[] = [
  { href: "/scan", label: "Scan", icon: ScanBarcode, tone: "bg-brand-600 text-white", permission: "stock.scan" },
  { href: "/receive", label: "Receive stock", icon: ArrowDownToLine, tone: "bg-ok-600 text-white", permission: "stock.receive" },
  { href: "/stock-out", label: "Stock out", icon: ArrowUpFromLine, tone: "bg-warn-600 text-white", permission: "stock.out" },
  { href: "/products/new", label: "Add product", icon: PackagePlus, tone: "bg-surface text-ink border border-line", permission: "product.write" },
];

function Stat({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: "warn" | "danger" }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold leading-tight", tone === "warn" && "text-warn-600", tone === "danger" && "text-danger-700")}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-muted">{sub}</p> : null}
    </>
  );
  const cls = "rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "block hover:border-brand-200")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700">
            See all <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="pb-2">{children}</div>
    </Card>
  );
}

export default async function DashboardPage() {
  const ctx = await requirePageContext();
  const [{ steps, complete }, d] = await Promise.all([getOnboardingProgress(ctx), getDashboard(ctx)]);
  const actions = QUICK_ACTIONS.filter((a) => roleCan(ctx.role, a.permission));
  const showValue = roleCan(ctx.role, "report.view");

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Hello ${ctx.userName.split(" ")[0]} 👋`} />

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {actions.map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href}
            className={`flex h-24 flex-col items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-sm transition active:scale-[0.98] ${tone}`}>
            <Icon className="size-7" aria-hidden />
            {label}
          </Link>
        ))}
      </section>

      {!complete ? (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold">Finish setting up</h2>
          <p className="mb-2 text-sm text-ink-muted">Complete these steps to start tracking stock.</p>
          <OnboardingChecklist steps={steps} />
        </Card>
      ) : null}

      <section aria-label="Stock summary" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Products" value={formatQty(d.totals.products)} href="/products" />
        <Stat label="Units in stock" value={formatQty(d.totals.units)} href="/inventory" />
        {showValue ? <Stat label="Stock value" value={formatMoney(d.totals.value)} sub="at purchase price" href="/inventory?sort=-value" /> : null}
        <Stat label="Low stock" value={formatQty(d.totals.lowStock)} href="/low-stock?status=low" tone={d.totals.lowStock ? "warn" : undefined} />
        <Stat label="Out of stock" value={formatQty(d.totals.outOfStock)} href="/low-stock?status=out" tone={d.totals.outOfStock ? "danger" : undefined} />
        <Stat label="Today in" value={`+${formatQty(d.today.inUnits)}`} sub={`${d.today.inMoves} entries`} href="/movements?direction=IN" />
        <Stat label="Today out" value={`−${formatQty(d.today.outUnits)}`} sub={`${d.today.outMoves} entries`} href="/movements?direction=OUT" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <h2 className="mb-2 font-semibold">Last 7 days</h2>
          <InOutChart series={d.series} />
        </Card>

        <Section title="Needs restocking" href="/low-stock">
          {d.lowStock.length ? (
            <ul className="divide-y divide-line">
              {d.lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    {p.qty <= 0 ? <PackageX className="size-5 shrink-0 text-danger-600" aria-label="Out of stock" /> : <AlertTriangle className="size-5 shrink-0 text-warn-600" aria-label="Low stock" />}
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-right text-sm">
                      <span className="font-bold">{formatQty(p.qty)}</span>
                      {p.minStock > 0 ? <span className="text-ink-muted"> / {formatQty(p.minStock)}</span> : null} {p.unit}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">Everything is above its minimum level.</p>
          )}
        </Section>

        <Section title="Top moving (30 days)" href="/movements?type=SALE">
          {d.topMoving.length ? (
            <ul className="divide-y divide-line">
              {d.topMoving.map((p, i) => (
                <li key={p.id}>
                  <Link href={`/products/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-ink-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="text-sm font-bold">−{formatQty(p.units)} <span className="font-normal text-ink-muted">{p.unit}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No stock out in the last 30 days.</p>
          )}
        </Section>

        <Section title="Recently received" href="/movements?type=PURCHASE">
          {d.recentReceipts.length ? (
            <ul className="divide-y divide-line">
              {d.recentReceipts.map((r) => (
                <li key={r.id}>
                  <Link href={`/products/${r.product.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.product.name}</p>
                      <p className="text-xs text-ink-muted">{formatDateTime(r.createdAt)}</p>
                    </div>
                    <span className="text-sm font-bold text-ok-700">+{formatQty(r.quantity)} <span className="font-normal text-ink-muted">{r.product.unit}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No stock received yet.</p>
          )}
        </Section>

        <Section title="Recent movements" href="/movements">
          {d.recentMovements.length ? (
            <ul className="divide-y divide-line">
              {d.recentMovements.map((m) => (
                <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.product.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {MOVEMENT_LABEL[m.type]} · {m.user.name} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold", m.direction === "IN" ? "text-ok-700" : "text-danger-700")}>
                    {formatSignedQty(m.quantity, m.direction)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">No movements yet.</p>
          )}
        </Section>
      </div>
    </>
  );
}
