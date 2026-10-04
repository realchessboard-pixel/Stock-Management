import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STOCK_STATUS_LABEL, type StockStatus } from "@/lib/stock-status";

const tones = {
  neutral: "bg-canvas text-ink-muted ring-line",
  ok: "bg-ok-50 text-ok-700 ring-ok-600/20",
  warn: "bg-warn-50 text-warn-600 ring-warn-600/25",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-500/20",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StockBadge({ status }: { status: StockStatus }) {
  const tone = status === "OUT" ? "danger" : status === "LOW" ? "warn" : "ok";
  return <Badge tone={tone}>{STOCK_STATUS_LABEL[status].toUpperCase()}</Badge>;
}
