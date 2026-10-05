"use client";

import Link from "next/link";
import { useActionState, useRef, useState, startTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatMoney, formatQty } from "@/lib/format";
import { commitImportAction, previewImportAction } from "@/server/actions/imports";
import type { ImportError } from "@/server/imports/products";

/**
 * Two-step import: (1) upload → server validates every row, nothing written;
 * (2) only if there are zero errors, confirm → server re-validates and
 * writes everything in one transaction.
 */
export function ImportWizard({ idempotencyKey }: { idempotencyKey: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [generateBarcodes, setGenerateBarcodes] = useState(true);
  const [preview, runPreview, previewing] = useActionState(previewImportAction, null);
  const [commit, runCommit, committing] = useActionState(commitImportAction, null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (f: File | null) => {
    setFile(f);
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    startTransition(() => runPreview(fd));
  };

  const doCommit = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("idempotencyKey", idempotencyKey);
    fd.set("generateBarcodes", String(generateBarcodes));
    startTransition(() => runCommit(fd));
  };

  if (commit?.ok) {
    const r = commit.data;
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-[var(--radius-card)] border border-ok-600/30 bg-ok-50 p-6">
          <CheckCircle2 className="mx-auto size-14 text-ok-600" aria-hidden />
          <p className="mt-2 text-xl font-bold text-ok-700">{r.created} products imported</p>
          <p className="mt-1 text-sm text-ink-muted">
            {r.withOpeningStock} with opening stock · {r.barcodesGenerated} barcodes generated
          </p>
        </div>
        <Link href="/products?sort=-createdAt" className={buttonClasses("primary", "xl", "w-full")}>View products</Link>
      </div>
    );
  }

  const p = preview?.ok ? preview.data : null;
  const previewError = preview && !preview.ok ? preview.error : null;
  const commitErrors = commit && !commit.ok ? ((commit.details?.errors as ImportError[] | undefined) ?? null) : null;
  const errors = commitErrors ?? p?.errors ?? [];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">1. Get the template</h2>
        <p className="text-sm text-ink-muted">
          Columns: Product Name (required), SKU, Barcode, Category, Brand, Unit, Purchase Price, Selling Price, MRP, GST Rate, HSN, Minimum Stock,
          Opening Stock. Blank SKUs and barcodes are generated for you.
        </p>
        <a href="/api/products/import-template" className={buttonClasses("secondary", "md")} download>
          <Download className="size-4" aria-hidden /> Download CSV template
        </a>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">2. Upload your file</h2>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          id="import-file"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
        <label htmlFor="import-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-canvas p-4 text-center hover:border-brand-500">
          {file ? <FileSpreadsheet className="size-8 text-brand-600" aria-hidden /> : <Upload className="size-8 text-ink-muted" aria-hidden />}
          <span className="font-semibold">{file ? file.name : "Choose CSV or Excel file"}</span>
          <span className="text-xs text-ink-muted">Max 5 MB · up to 5,000 products</span>
        </label>
        {previewing ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner /> Checking every row…</p>
        ) : null}
        {previewError ? <Alert tone="error">{previewError}</Alert> : null}
      </Card>

      {p && !previewing ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">3. Check and import</h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-ok-50 p-3">
              <p className="text-2xl font-bold text-ok-700">{p.validCount}</p>
              <p className="text-sm">ready to import</p>
            </div>
            <div className={p.errorCount ? "rounded-xl bg-danger-50 p-3" : "rounded-xl bg-canvas p-3"}>
              <p className={p.errorCount ? "text-2xl font-bold text-danger-700" : "text-2xl font-bold text-ink-muted"}>{p.errorCount}</p>
              <p className="text-sm">rows with errors</p>
            </div>
          </div>
          {p.unknownColumns.length ? (
            <Alert tone="info">These columns were ignored: {p.unknownColumns.join(", ")}</Alert>
          ) : null}

          {errors.length ? (
            <div className="space-y-2">
              <Alert tone="error">
                Fix these rows in your file and upload it again. <strong>Nothing will be imported until every row is correct.</strong>
              </Alert>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                {errors.map((e, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
                    <span>
                      <strong>Row {e.row}:</strong> {e.message}
                    </span>
                  </li>
                ))}
              </ul>
              {p.errors.length >= 200 ? <p className="text-xs text-ink-muted">Showing the first 200 errors.</p> : null}
              <Button variant="secondary" className="w-full" onClick={() => inputRef.current?.click()}>
                <Upload className="size-5" aria-hidden /> Upload fixed file
              </Button>
            </div>
          ) : (
            <>
              {p.sample.length ? (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-canvas text-xs uppercase text-ink-muted">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Opening</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {p.sample.map((s) => (
                        <tr key={s.row}>
                          <td className="px-3 py-2 text-ink-muted">{s.row}</td>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{s.sku ?? "auto"}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(s.price)}</td>
                          <td className="px-3 py-2 text-right">{formatQty(s.opening)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <label className="flex min-h-12 items-center gap-3">
                <input type="checkbox" checked={generateBarcodes} onChange={(e) => setGenerateBarcodes(e.target.checked)} className="size-5 accent-brand-600" />
                Generate barcodes for products without one
              </label>
              {commit && !commit.ok && !commitErrors ? <Alert tone="error">{commit.error}</Alert> : null}
              <Button size="xl" className="w-full" onClick={doCommit} disabled={committing || p.validCount === 0}>
                {committing ? (
                  <>
                    <Spinner /> Importing…
                  </>
                ) : (
                  `Import ${p.validCount} products`
                )}
              </Button>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
