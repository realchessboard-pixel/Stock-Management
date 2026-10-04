"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Spinner } from "./spinner";

/**
 * Debounced search box bound to the `q` URL param (shareable, back-button
 * friendly, and the server does the filtering — no big lists in the browser).
 */
export function SearchBox({ placeholder = "Search…", autoFocus = false }: { placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const push = (q: string) => {
    const sp = new URLSearchParams(params.toString());
    if (q.trim()) sp.set("q", q.trim());
    else sp.delete("q");
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        push(value);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(() => push(v), 300);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="block h-12 w-full rounded-xl border border-line bg-surface pl-12 pr-12 text-base placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Spinner className="size-5 text-ink-muted" />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-canvas"
            onClick={() => {
              setValue("");
              push("");
            }}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </span>
    </form>
  );
}
