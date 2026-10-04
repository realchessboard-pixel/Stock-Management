"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/cn";
import { roleCan, ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { isActive, SIDEBAR_NAV } from "./nav-config";

export function Sidebar({ role, businessName, userName }: { role: RoleName; businessName: string; userName: string }) {
  const pathname = usePathname();
  const items = SIDEBAR_NAV.filter((i) => !i.permission || roleCan(role, i.permission));
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">StockFlow</p>
        <p className="truncate text-lg font-bold" title={businessName}>
          {businessName}
        </p>
      </div>
      <div className="p-3">
        <Link
          href="/scan"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <ScanBarcode className="size-5" aria-hidden /> Scan barcode
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                    active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex items-center gap-3 border-t border-line p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{userName}</p>
          <p className="text-xs text-ink-muted">{ROLE_LABELS[role]}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </aside>
  );
}
