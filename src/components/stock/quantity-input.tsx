"use client";

import { Minus, Plus } from "lucide-react";

/** Big numeric input with −/+ steppers, sized for thumbs. Value is a decimal string. */
export function QuantityInput({
  name,
  label,
  value,
  onChange,
  unit,
  error,
  autoFocus,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  error?: string[];
  autoFocus?: boolean;
}) {
  const step = (delta: number) => {
    const n = Number(value || "0");
    const next = Math.max(0, (Number.isFinite(n) ? n : 0) + delta);
    onChange(String(Math.round(next * 1000) / 1000));
  };
  const id = `q-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => step(-1)} aria-label="Decrease" className="flex w-16 items-center justify-center rounded-xl border border-line bg-surface active:bg-canvas">
          <Minus className="size-6" aria-hidden />
        </button>
        <div className="relative flex-1">
          <input
            id={id}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="0"
            aria-invalid={error?.length ? true : undefined}
            className="h-16 w-full rounded-xl border border-line bg-surface text-center text-3xl font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-danger-600"
          />
          {unit ? <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{unit}</span> : null}
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Increase" className="flex w-16 items-center justify-center rounded-xl border border-line bg-surface active:bg-canvas">
          <Plus className="size-6" aria-hidden />
        </button>
      </div>
      {error?.length ? <p className="text-sm text-danger-600">{error[0]}</p> : null}
    </div>
  );
}
