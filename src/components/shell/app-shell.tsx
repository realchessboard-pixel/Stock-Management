import type { ReactNode } from "react";
import type { TenantContext } from "@/server/tenancy/context";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ ctx, children }: { ctx: TenantContext; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar role={ctx.role} businessName={ctx.businessName} userName={ctx.userName} />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="truncate text-base font-bold">{ctx.businessName}</p>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 lg:pl-72 lg:pr-8 lg:pb-10 lg:max-w-none">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <BottomNav role={ctx.role} />
    </div>
  );
}
