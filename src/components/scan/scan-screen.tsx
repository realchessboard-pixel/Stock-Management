"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Eye, History, PackagePlus, ScanBarcode, SearchX, SlidersHorizontal } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { roleCan, type RoleName } from "@/lib/permissions";
import { lookupCodeAction } from "@/server/actions/stock";
import type { ProductSummary } from "@/server/products/summary";
import { BarcodeScanner } from "./barcode-scanner";
import { scanFeedback } from "./feedback";
import { ManualCodeEntry } from "./manual-code-entry";
import { ProductCard } from "./product-card";
import { useHidScanner } from "./use-hid-scanner";

type State =
  | { kind: "scanning" }
  | { kind: "found"; product: ProductSummary }
  | { kind: "not-found"; code: string }
  | { kind: "error"; message: string };

export function ScanScreen({ role }: { role: RoleName }) {
  const [state, setState] = useState<State>({ kind: "scanning" });
  const [pending, startTransition] = useTransition();

  const lookup = useCallback((code: string) => {
    startTransition(async () => {
      const res = await lookupCodeAction(code);
      if (!res.ok) {
        scanFeedback(false);
        setState({ kind: "error", message: res.error });
      } else if (res.data.product) {
        scanFeedback(true);
        setState({ kind: "found", product: res.data.product });
      } else {
        scanFeedback(false);
        setState({ kind: "not-found", code: res.data.code });
      }
    });
  }, []);

  useHidScanner(lookup);
  const paused = state.kind !== "scanning" || pending;
  const resume = () => setState({ kind: "scanning" });
  const can = (p: Parameters<typeof roleCan>[1]) => roleCan(role, p);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <BarcodeScanner onDetected={lookup} paused={paused} />
      <ManualCodeEntry onSubmit={lookup} disabled={pending} />

      <div aria-live="polite" className="space-y-4">
        {pending ? (
          <div className="flex items-center justify-center gap-2 py-6 text-ink-muted">
            <Spinner /> Looking up…
          </div>
        ) : null}

        {!pending && state.kind === "found" ? (
          <>
            <ProductCard product={state.product} />
            {state.product.archived ? <Alert tone="info">This product is archived. Restore it to move stock.</Alert> : null}
            <div className="grid grid-cols-2 gap-3">
              {can("stock.receive") && !state.product.archived ? (
                <Link href={`/receive?product=${state.product.id}`} className={buttonClasses("success", "xl")}>
                  <ArrowDownToLine className="size-6" aria-hidden /> Receive
                </Link>
              ) : null}
              {can("stock.out") && !state.product.archived ? (
                <Link href={`/stock-out?product=${state.product.id}`} className={buttonClasses("primary", "xl", "bg-warn-600 hover:bg-warn-600/90")}>
                  <ArrowUpFromLine className="size-6" aria-hidden /> Stock out
                </Link>
              ) : null}
              {can("stock.adjust") && !state.product.archived ? (
                <Link href={`/adjust?product=${state.product.id}`} className={buttonClasses("secondary", "lg")}>
                  <SlidersHorizontal className="size-5" aria-hidden /> Adjust
                </Link>
              ) : null}
              <Link href={`/products/${state.product.id}`} className={buttonClasses("secondary", "lg")}>
                <Eye className="size-5" aria-hidden /> View
              </Link>
              {can("stock.ledger") ? (
                <Link href={`/products/${state.product.id}/ledger`} className={buttonClasses("secondary", "lg")}>
                  <History className="size-5" aria-hidden /> Ledger
                </Link>
              ) : null}
            </div>
            <Button variant="ghost" size="lg" className="w-full" onClick={resume}>
              <ScanBarcode className="size-5" aria-hidden /> Scan another
            </Button>
          </>
        ) : null}

        {!pending && state.kind === "not-found" ? (
          <div className="rounded-[var(--radius-card)] border border-warn-600/30 bg-warn-50 p-5 text-center">
            <SearchX className="mx-auto size-10 text-warn-600" aria-hidden />
            <p className="mt-2 text-lg font-bold">Product not found</p>
            <p className="mt-1 text-sm text-ink-muted">
              No product has the code <span className="font-mono font-semibold text-ink">{state.code}</span>
            </p>
            <div className="mt-4 grid gap-3">
              {can("product.write") ? (
                <Link href={`/products/new?barcode=${encodeURIComponent(state.code)}`} className={buttonClasses("primary", "xl")}>
                  <PackagePlus className="size-6" aria-hidden /> Create product
                </Link>
              ) : (
                <p className="text-sm">Ask a manager to add this product.</p>
              )}
              <Button variant="secondary" size="lg" onClick={resume}>
                Scan again
              </Button>
            </div>
          </div>
        ) : null}

        {!pending && state.kind === "error" ? (
          <>
            <Alert tone="error">{state.message}</Alert>
            <Button variant="secondary" size="lg" className="w-full" onClick={resume}>
              Try again
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
