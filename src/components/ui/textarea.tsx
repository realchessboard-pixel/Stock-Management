import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function TextareaField({
  label,
  name,
  error,
  className,
  ...props
}: { label: string; name: string; error?: string[] } & Omit<ComponentProps<"textarea">, "name">) {
  const id = `f-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        aria-invalid={error?.length ? true : undefined}
        className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        {...props}
      />
      {error?.length ? <p className="text-sm text-danger-600">{error[0]}</p> : null}
    </div>
  );
}
