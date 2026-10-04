import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const styles = {
  error: { box: "bg-danger-50 text-danger-700 border-danger-600/20", Icon: AlertCircle },
  success: { box: "bg-ok-50 text-ok-700 border-ok-600/20", Icon: CheckCircle2 },
  info: { box: "bg-brand-50 text-brand-800 border-brand-500/20", Icon: Info },
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof styles; children: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
