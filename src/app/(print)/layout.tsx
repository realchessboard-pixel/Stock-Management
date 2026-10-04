import { requirePageContext } from "@/server/tenancy/context";

/** Minimal chrome for printable pages (labels). Still requires login. */
export default async function PrintLayout({ children }: LayoutProps<"/">) {
  await requirePageContext();
  return <div className="min-h-dvh bg-canvas print:bg-white">{children}</div>;
}
