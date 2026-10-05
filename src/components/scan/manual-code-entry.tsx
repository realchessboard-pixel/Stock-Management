"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";

/** Type or paste a barcode/SKU (also works with keyboard-wedge scanners while focused). */
export function ManualCodeEntry({ onSubmit, disabled }: { onSubmit: (code: string) => void; disabled?: boolean }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim();
        if (c) {
          onSubmit(c);
          setCode("");
        }
      }}
      className="flex gap-2"
    >
      <label className="relative flex-1">
        <span className="sr-only">Barcode or SKU</span>
        <Keyboard className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type barcode or SKU"
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="go"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-12 pr-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </label>
      <button type="submit" disabled={disabled || !code.trim()} className="h-12 rounded-xl bg-ink px-5 font-semibold text-white disabled:opacity-40">
        Find
      </button>
    </form>
  );
}
