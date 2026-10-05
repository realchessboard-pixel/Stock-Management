import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/pwa";
import { MORE_NAV } from "@/components/shell/nav-config";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { roleCan, ROLE_LABELS } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { requirePageContext } from "@/server/tenancy/context";

export const metadata: Metadata = { title: "More" };

export default async function MorePage() {
  const ctx = await requirePageContext();
  const items = MORE_NAV.filter((i) => !i.permission || roleCan(ctx.role, i.permission));
  return (
    <>
      <PageHeader title="More" />
      <Card className="mb-4">
        <p className="text-lg font-semibold">{ctx.userName}</p>
        <p className="text-sm text-ink-muted">
          {ROLE_LABELS[ctx.role]} · {ctx.businessName}
        </p>
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex h-14 items-center gap-4 px-4 text-base font-medium">
                <Icon className="size-5 text-ink-muted" aria-hidden />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-5 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <div className="mt-4">
        <InstallAppButton />
      </div>
      <form action={logoutAction} className="mt-4">
        <button
          type="submit"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-semibold text-danger-600"
        >
          <LogOut className="size-5" aria-hidden /> Log out
        </button>
      </form>
    </>
  );
}
