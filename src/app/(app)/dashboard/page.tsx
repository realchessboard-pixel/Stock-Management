import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, ScanBarcode, type LucideIcon } from "lucide-react";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { roleCan, type Permission } from "@/lib/permissions";
import { getOnboardingProgress } from "@/server/onboarding/progress";
import { requirePageContext } from "@/server/tenancy/context";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS: { href: string; label: string; icon: LucideIcon; tone: string; permission: Permission }[] = [
  { href: "/scan", label: "Scan", icon: ScanBarcode, tone: "bg-brand-600 text-white", permission: "stock.scan" },
  { href: "/receive", label: "Receive stock", icon: ArrowDownToLine, tone: "bg-ok-600 text-white", permission: "stock.receive" },
  { href: "/stock-out", label: "Stock out", icon: ArrowUpFromLine, tone: "bg-warn-600 text-white", permission: "stock.out" },
  { href: "/products/new", label: "Add product", icon: PackagePlus, tone: "bg-surface text-ink border border-line", permission: "product.write" },
];

export default async function DashboardPage() {
  const ctx = await requirePageContext();
  const { steps, complete } = await getOnboardingProgress(ctx);
  const actions = QUICK_ACTIONS.filter((a) => roleCan(ctx.role, a.permission));

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Hello ${ctx.userName.split(" ")[0]} 👋`} />

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {actions.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`flex h-24 flex-col items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-sm transition active:scale-[0.98] ${tone}`}
          >
            <Icon className="size-7" aria-hidden />
            {label}
          </Link>
        ))}
      </section>

      {!complete ? (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Finish setting up</h2>
          <p className="mb-2 text-sm text-ink-muted">Complete these steps to start tracking stock.</p>
          <OnboardingChecklist steps={steps} />
        </Card>
      ) : null}
    </>
  );
}
