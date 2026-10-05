"use client";

import { useState } from "react";
import { ArrowUpFromLine, RotateCcw, ScanBarcode } from "lucide-react";
import { ProductCard } from "@/components/scan/product-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { formatMoney, formatQty } from "@/lib/format";
import { stockOutAction } from "@/server/actions/stock";
import type { ProductSummary } from "@/server/products/summary";
import { QuantityInput } from "./quantity-input";
import { StockSuccess } from "./stock-success";

export function StockOutForm({
  product,
  idempotencyKey,
  locations,
  allowNegative,
}: {
  product: ProductSummary;
  idempotencyKey: string;
  locations: { id: string; name: string; isDefault: boolean }[];
  allowNegative: boolean;
}) {
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(stockOutAction);
  const [qty, setQty] = useState("1");

  if (state?.ok) {
    return (
      <StockSuccess
        title="Stock removed"
        result={state.data}
        sign="−"
        actions={
          <div className="grid grid-cols-2 gap-3">
            <a href="/scan" className={buttonClasses("primary", "xl")}>
              <ScanBarcode className="size-6" aria-hidden /> Scan next
            </a>
            <a href="/stock-out" className={buttonClasses("secondary", "xl")}>
              <RotateCcw className="size-5" aria-hidden /> Another
            </a>
          </div>
        }
      />
    );
  }

  const n = Number(qty);
  const tooMany = !allowNegative && n > product.onHand;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="productId" value={product.id} />
      <ProductCard product={product} />
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {product.onHand <= 0 && !allowNegative ? <Alert tone="error">This product is out of stock.</Alert> : null}

      <Card className="space-y-4">
        <QuantityInput name="quantity" label="Quantity going out" value={qty} onChange={setQty} unit={product.unit} error={fe?.quantity ?? (tooMany ? [`Only ${formatQty(product.onHand)} available`] : undefined)} autoFocus />
        {locations.length > 1 ? (
          <SelectField label="From location" name="locationId" defaultValue={locations.find((l) => l.isDefault)?.id}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </SelectField>
        ) : null}
        <Field label="Note (optional)" name="note" placeholder="e.g. Customer name or bill no." autoComplete="off" error={fe?.note} />
      </Card>

      <div className="sticky bottom-20 z-10 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:px-0">
        {n > 0 ? <p className="mb-2 text-center text-sm text-ink-muted">Value {formatMoney(n * Number(product.sellingPrice))}</p> : null}
        <SubmitButton pending={pending} size="xl" className="w-full bg-warn-600 hover:bg-warn-600/90" pendingText="Saving…" disabled={!(n > 0) || tooMany}>
          <ArrowUpFromLine className="size-6" aria-hidden />
          {n > 0 ? `Confirm −${formatQty(qty)} ${product.unit}` : "Enter quantity"}
        </SubmitButton>
      </div>
    </form>
  );
}
