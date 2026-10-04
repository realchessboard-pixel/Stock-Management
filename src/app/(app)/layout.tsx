import { AppShell } from "@/components/shell/app-shell";
import { requirePageContext } from "@/server/tenancy/context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requirePageContext();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
