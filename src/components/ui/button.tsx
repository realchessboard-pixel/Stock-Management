import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm",
  success: "bg-ok-600 text-white hover:bg-ok-700 shadow-sm",
};

// Minimum 48px touch targets (WCAG / Material guidance).
const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-sm min-w-11",
  lg: "h-12 px-5 text-base",
  xl: "h-14 px-6 text-lg",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "lg", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "lg",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "lg",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
