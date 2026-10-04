"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Printer } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { selectClasses } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { LABEL_PRESETS, MAX_LABELS_PER_PRINT } from "@/lib/labels";

export type LabelItem = {
  id: string;
  name: string;
  sku: string;
  price: string;
  mrp: string | null;
  code: string;
  /** Pre-rendered Code 128 SVG from the server (validated charset, paths only). */
  svg: string;
  qty: number;
};

type Show = { business: boolean; name: boolean; sku: boolean; price: boolean };

export function LabelSheet({ items, businessName, skipped }: { items: LabelItem[]; businessName: string; skipped: string[] }) {
  const [presetId, setPresetId] = useState(LABEL_PRESETS[0].id);
  const [show, setShow] = useState<Show>({ business: true, name: true, sku: false, price: true });
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.qty])));
  const preset = LABEL_PRESETS.find((p) => p.id === presetId) ?? LABEL_PRESETS[0];

  const labels = useMemo(() => items.flatMap((item) => Array.from({ length: qty[item.id] ?? 0 }, () => item)), [items, qty]);
  const total = labels.length;
  // A4 sheets are split into physical pages so every page starts at the sheet's top margin.
  const perPage = preset.kind === "sheet" ? (preset.columns ?? 1) * (preset.rows ?? 1) : Math.max(1, total);
  const pages = useMemo(() => {
    const out: LabelItem[][] = [];
    for (let i = 0; i < labels.length; i += perPage) out.push(labels.slice(i, i + perPage));
    return out;
  }, [labels, perPage]);
  const tooMany = total > MAX_LABELS_PER_PRINT;
  const small = preset.heightMm < 24;

  const pageCss =
    preset.kind === "roll"
      ? `@page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }`
      : `@page { size: A4; margin: 0; }`;

  return (
    <>
      <style>{`
        ${pageCss}
        @media print {
          html, body { background: #fff !important; }
          .label-sheet { padding: ${preset.kind === "sheet" ? `${preset.marginTopMm}mm 0 0 ${preset.marginLeftMm}mm` : "0"} !important; gap: ${preset.kind === "sheet" ? `${preset.gapYMm}mm ${preset.gapXMm}mm` : "0"} !important; }
          .label { border: none !important; box-shadow: none !important; ${preset.kind === "roll" ? "break-after: page;" : ""} }
        }
      `}</style>

      <div className="sticky top-0 z-20 border-b border-line bg-surface p-4 shadow-sm print:hidden">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/products" className="flex size-11 items-center justify-center rounded-xl hover:bg-canvas" aria-label="Back">
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            <h1 className="flex-1 text-xl font-bold">Print labels</h1>
            <Button onClick={() => window.print()} disabled={total === 0 || tooMany} size="lg">
              <Printer className="size-5" aria-hidden /> Print {total}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="sr-only">Label size</span>
              <select className={selectClasses} value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                {LABEL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Show on label</legend>
              {(
                [
                  ["business", "Shop name"],
                  ["name", "Product name"],
                  ["sku", "SKU"],
                  ["price", "Price"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <input type="checkbox" className="size-4 accent-brand-600" checked={show[key]} onChange={(e) => setShow((s) => ({ ...s, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
          {skipped.length ? <Alert tone="info">Skipped (no barcode): {skipped.join(", ")}</Alert> : null}
          {tooMany ? <Alert tone="error">Print at most {MAX_LABELS_PER_PRINT} labels at a time.</Alert> : null}
          <ul className="divide-y divide-line rounded-xl border border-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                <button type="button" aria-label={`Fewer labels for ${item.name}`} className="flex size-10 items-center justify-center rounded-lg border border-line"
                  onClick={() => setQty((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 1) }))}>
                  <Minus className="size-4" aria-hidden />
                </button>
                <input aria-label={`Labels for ${item.name}`} inputMode="numeric" className="h-10 w-16 rounded-lg border border-line text-center"
                  value={qty[item.id] ?? 0}
                  onChange={(e) => setQty((q) => ({ ...q, [item.id]: Math.min(500, Math.max(0, Number.parseInt(e.target.value || "0", 10) || 0)) }))} />
                <button type="button" aria-label={`More labels for ${item.name}`} className="flex size-10 items-center justify-center rounded-lg border border-line"
                  onClick={() => setQty((q) => ({ ...q, [item.id]: Math.min(500, (q[item.id] ?? 0) + 1) }))}>
                  <Plus className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {pages.map((page, pi) => (
        <div
          key={pi}
          className="label-sheet mx-auto flex max-w-5xl flex-wrap content-start gap-3 p-4 print:m-0 print:max-w-none print:p-0"
          style={preset.kind === "sheet" ? { breakAfter: pi < pages.length - 1 ? "page" : "auto" } : undefined}
        >
          {page.map((l, i) => (
            <div
              key={`${l.id}-${i}`}
              className="label flex flex-col items-center justify-center overflow-hidden border border-dashed border-ink-faint bg-white text-black shadow-sm"
              style={{ width: `${preset.widthMm}mm`, height: `${preset.heightMm}mm`, padding: "1.2mm 1.5mm" }}
            >
              {show.business ? <p className="w-full truncate text-center font-semibold uppercase leading-none" style={{ fontSize: small ? "5.5pt" : "6.5pt" }}>{businessName}</p> : null}
              {show.name ? <p className="line-clamp-2 w-full text-center font-bold leading-tight" style={{ fontSize: small ? "6.5pt" : "8pt" }}>{l.name}</p> : null}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center [&_svg]:h-full [&_svg]:max-h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: l.svg }} />
              {show.sku || show.price ? (
                <div className="flex w-full justify-between gap-1 leading-none" style={{ fontSize: small ? "6pt" : "7.5pt" }}>
                  <span className="truncate">{show.sku ? l.sku : ""}</span>
                  {show.price && Number(l.price) > 0 ? <span className="shrink-0 font-bold">{formatMoney(l.price)}</span> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
      <p className="pb-10 text-center text-sm text-ink-muted print:hidden">
        Tip: in the print dialog choose your label printer, set margins to “None” and scale to 100%.
      </p>
    </>
  );
}
