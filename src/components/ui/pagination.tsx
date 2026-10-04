import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Prev/next pager that preserves other query params. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const btn = "flex h-11 items-center gap-1 rounded-xl border border-line bg-surface px-4 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      {page > 1 ? (
        <Link href={href(page - 1)} className={btn}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </span>
      )}
      <span className="text-sm text-ink-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={btn}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className={cn(btn, "opacity-40")}>
          Next <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}
