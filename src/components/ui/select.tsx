import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type SelectFieldProps = {
  label: string;
  name: string;
  error?: string[];
  hint?: ReactNode;
  children: ReactNode;
} & Omit<ComponentProps<"select">, "name">;

export const selectClasses =
  "block h-12 w-full appearance-none rounded-xl border border-line bg-surface pl-4 pr-10 text-base text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-danger-600";

export function SelectField({ label, name, error, hint, className, children, id, ...props }: SelectFieldProps) {
  const selectId = id ?? `f-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={selectId} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <select id={selectId} name={name} aria-invalid={error?.length ? true : undefined} className={selectClasses} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      </div>
      {hint && !error?.length ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error?.length ? <p className="text-sm text-danger-600">{error[0]}</p> : null}
    </div>
  );
}
