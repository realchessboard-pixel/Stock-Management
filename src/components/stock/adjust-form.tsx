"use client";

import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/scan/product-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/cn";
import { formatQty } from "@/lib/format";
import { ADJUSTMENT_TYPES, MOVEMENT_DIRECTION, MOVEMENT_LABEL, type AdjustmentType } from "@/lib/movements";
import { adjustStockAction } from "@/server/actions/stock";
import type { ProductSummary } from "@/server/products/summary";
import { QuantityInput } from "./quantity-input";
import { StockSuccess } from "./stock-success";

const QUICK_REASONS: Record<AdjustmentType, string[]> = {
  ADJUSTMENT_IN: ["Found extra", "Counting error", "Free goods from supplier"],
  ADJUSTMENT_OUT: ["Counting error", "Used in shop", "Sample given"],
  DAMAGE: ["Broken", "Rusted", "Damaged in transit"],
  LOSS: ["Missing", "Theft", "Expired"],
  CUSTOMER_RETURN: ["Customer returned", "Wrong item sold"],
  SUPPLIER_RETURN: ["Defective, sent back", "Wrong item received"],
};

export function AdjustForm({
  product,
  idempotencyKey,
  locations,
}: {
  product: ProductSummary;
  idempotencyKey: string;
  locations: { id: string; name: string; isDefault: boolean }[];
}) {
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(adjustStockAction);
  const [mode, setMode] = useState<"change" | "count">("change");
  const [type, setType] = useState<AdjustmentType>("DAMAGE");
  const [qty, setQty] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");

  if (state?.ok) {
    const r = state.data;
    const sign = Number(r.newBalance) >= Number(r.previousBalance) ? "+" : "−";
    return (
      <StockSuccess
        title="Stock adjusted"
        result={r}
        sign={sign}
        actions={
          <a href="/adjust" className={buttonClasses("secondary", "xl")}>
            <RotateCcw className="size-5" aria-hidden /> Adjust another product
          </a>
        }
      />
    );
  }

  const countDiff = counted !== "" ? Number(counted) - product.onHand : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="mode" value={mode} />
      <ProductCard product={product} />
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-line/60 p-1">
        {(
          [
            ["change", "Add / remove"],
            ["count", "Stock count"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cn("h-11 rounded-lg text-sm font-semibold", mode === m ? "bg-surface shadow-sm" : "text-ink-muted")}>
            {label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        {mode === "change" ? (
          <>
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium">What happened?</legend>
              <input type="hidden" name="type" value={type} />
              <div className="grid grid-cols-2 gap-2">
                {ADJUSTMENT_TYPES.map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}
                    className={cn("flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm font-semibold",
                      type === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface")}>
                    {MOVEMENT_LABEL[t]}
                    <span className={MOVEMENT_DIRECTION[t] === "IN" ? "text-ok-600" : "text-danger-600"}>{MOVEMENT_DIRECTION[t] === "IN" ? "+" : "−"}</span>
                  </button>
                ))}
              </div>
              {fe?.type ? <p className="mt-1 text-sm text-danger-600">{fe.type[0]}</p> : null}
            </fieldset>
            <QuantityInput name="quantity" label="Quantity" value={qty} onChange={setQty} unit={product.unit} error={fe?.quantity} />
          </>
        ) : (
          <>
            <QuantityInput name="countedQuantity" label="How many did you count?" value={counted} onChange={setCounted} unit={product.unit} error={fe?.countedQuantity} autoFocus />
            {countDiff !== null && Number.isFinite(countDiff) ? (
              <p className={cn("text-center text-sm font-semibold", countDiff === 0 ? "text-ink-muted" : countDiff > 0 ? "text-ok-700" : "text-danger-700")}>
                {countDiff === 0 ? "Matches current stock" : `${countDiff > 0 ? "+" : "−"}${formatQty(Math.abs(countDiff))} ${product.unit} will be adjusted`}
              </p>
            ) : null}
          </>
        )}

        <div className="space-y-2">
          <Field label="Reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you adjusting?" autoComplete="off" error={fe?.reason} />
          <div className="flex flex-wrap gap-2">
            {(mode === "change" ? QUICK_REASONS[type] : ["Monthly stock count", "Shelf check"]).map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="h-9 rounded-full border border-line bg-surface px-3 text-sm">
                {r}
              </button>
            ))}
          </div>
        </div>

        {locations.length > 1 ? (
          <SelectField label="Location" name="locationId" defaultValue={locations.find((l) => l.isDefault)?.id}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </SelectField>
        ) : null}
      </Card>

      <div className="sticky bottom-20 z-10 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:px-0">
        <SubmitButton pending={pending} size="xl" className="w-full" pendingText="Saving…">
          <SlidersHorizontal className="size-6" aria-hidden /> Confirm adjustment
        </SubmitButton>
      </div>
    </form>
  );
}
