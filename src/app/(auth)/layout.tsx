import { Boxes } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2 text-brand-700">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Boxes className="size-6" aria-hidden />
        </span>
        <span className="text-2xl font-bold tracking-tight">StockFlow</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
