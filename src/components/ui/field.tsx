import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClasses =
  "block w-full h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-danger-600";

type FieldProps = {
  label: string;
  name: string;
  error?: string[];
  hint?: ReactNode;
} & Omit<ComponentProps<"input">, "name">;

export function Field({ label, name, error, hint, className, id, ...props }: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const errId = `${inputId}-error`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? errId : undefined}
        className={inputClasses}
        {...props}
      />
      {hint && !error?.length ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error?.length ? (
        <p id={errId} className="text-sm text-danger-600">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}
