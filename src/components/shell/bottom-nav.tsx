"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { roleCan, type RoleName } from "@/lib/permissions";
import { BOTTOM_NAV, isActive } from "./nav-config";

export function BottomNav({ role }: { role: RoleName }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV.filter((i) => !i.permission || roleCan(role, i.permission));
  return (
    <nav
      aria-label="Main"
      className="bottom-nav pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          if (item.href === "/scan") {
            return (
              <li key={item.href} className="-mt-6">
                <Link
                  href={item.href}
                  aria-label="Scan barcode"
                  aria-current={active ? "page" : undefined}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="flex size-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-surface transition active:scale-95">
                    <Icon className="size-8" aria-hidden />
                  </span>
                  <span className="pb-2 text-xs font-semibold text-brand-700">Scan</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-brand-700" : "text-ink-muted",
                )}
              >
                <Icon className={cn("size-6", active && "stroke-[2.5]")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
