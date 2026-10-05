"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PackagePlus, ScanBarcode, Search, X } from "lucide-react";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { scanFeedback } from "@/components/scan/feedback";
import { useHidScanner } from "@/components/scan/use-hid-scanner";
import { Alert } from "@/components/ui/alert";
import { StockBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatQty } from "@/lib/format";
import { lookupCodeAction, searchProductsAction, type ProductHit } from "@/server/actions/stock";

/**
 * Step 1 of receive / stock-out / adjust: pick a product by scanning
 * (camera or scanner gun) or by searching. Navigates to `${basePath}?product=id`.
 */
export function ProductPicker({ basePath, canCreate }: { basePath: string; canCreate: boolean }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [navigating, startNav] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const choose = (id: string) => startNav(() => router.push(`${basePath}?product=${id}`));

  const lookup = (code: string) => {
    setNotFound(null);
    setError(null);
    startTransition(async () => {
      const res = await lookupCodeAction(code);
      if (!res.ok) return setError(res.error);
      if (res.data.product) {
        scanFeedback(true);
        setScanning(false);
        choose(res.data.product.id);
      } else {
        scanFeedback(false);
        setNotFound(res.data.code);
      }
    });
  };
  useHidScanner(lookup);

  useEffect(() => () => clearTimeout(timer.current), []);
  const search = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    if (!value.trim()) return setHits(null);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchProductsAction(value);
        if (res.ok) setHits(res.data);
        else setError(res.error);
      });
    }, 250);
  };

  return (
    <div className="space-y-4">
      {scanning ? (
        <div className="space-y-3">
          <BarcodeScanner onDetected={lookup} paused={pending || navigating} />
          <Button variant="secondary" className="w-full" onClick={() => setScanning(false)}>
            <X className="size-5" aria-hidden /> Close camera
          </Button>
        </div>
      ) : (
        <Button size="xl" className="h-20 w-full text-xl" onClick={() => setScanning(true)}>
          <ScanBarcode className="size-7" aria-hidden /> Scan barcode
        </Button>
      )}

      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <span className="h-px flex-1 bg-line" /> or search <span className="h-px flex-1 bg-line" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Enter on a full code (e.g. typed barcode) does an exact lookup.
          if (q.trim()) lookup(q.trim());
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Product name, SKU or barcode"
          aria-label="Search products"
          autoComplete="off"
          enterKeyHint="search"
          className="block h-14 w-full rounded-xl border border-line bg-surface pl-12 pr-12 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        {pending || navigating ? <Spinner className="absolute right-4 top-4 text-ink-muted" /> : null}
      </form>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notFound ? (
        <Alert tone="info">
          <p>
            No product with code <span className="font-mono font-semibold">{notFound}</span>.
          </p>
          {canCreate ? (
            <Link href={`/products/new?barcode=${encodeURIComponent(notFound)}`} className={buttonClasses("primary", "md", "mt-2")}>
              <PackagePlus className="size-4" aria-hidden /> Create product
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {hits ? (
        hits.length ? (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => choose(h.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{h.name}</p>
                    <p className="truncate font-mono text-sm text-ink-muted">{h.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {formatQty(h.onHand)} <span className="text-xs font-normal text-ink-muted">{h.unit}</span>
                    </p>
                    <StockBadge status={h.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-ink-muted">No products match “{q}”.</p>
        )
      ) : null}
    </div>
  );
}
