"use client";

import type { ReactNode } from "react";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/result";
import { cn } from "@/lib/cn";

/** One-button form posting hidden fields to a Server Action, with optional confirm and inline error. */
export function InlineAction<T>({
  action,
  fields,
  children,
  confirmText,
  className,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult<T>>;
  fields: Record<string, string>;
  children: ReactNode;
  confirmText?: string;
  className?: string;
}) {
  const { pending, onSubmit, formError, fieldErrors } = useFormAction(action);
  const err = formError ?? (fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined);
  return (
    <form
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) return e.preventDefault();
        onSubmit(e);
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50", className)}>
        {children}
      </button>
      {err ? <p role="alert" className="mt-1 text-sm text-danger-600">{err}</p> : null}
    </form>
  );
}
