"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownToLine, Printer, RotateCcw, ScanBarcode } from "lucide-react";
import { ProductCard } from "@/components/scan/product-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { formatMoney, formatQty } from "@/lib/format";
import { receiveStockAction } from "@/server/actions/stock";
import type { ProductSummary } from "@/server/products/summary";
import { QuantityInput } from "./quantity-input";
import { StockSuccess } from "./stock-success";

type Opt = { id: string; name: string };

export function ReceiveForm({
  product,
  idempotencyKey,
  suppliers,
  locations,
  canPrint,
}: {
  product: ProductSummary;
  idempotencyKey: string;
  suppliers: Opt[];
  locations: (Opt & { isDefault: boolean })[];
  canPrint: boolean;
}) {
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(receiveStockAction);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(Number(product.purchasePrice) > 0 ? String(Number(product.purchasePrice)) : "");

  if (state?.ok) {
    const r = state.data;
    return (
      <StockSuccess
        title="Stock received"
        result={r}
        sign="+"
        actions={
          <>
            {canPrint && product.barcode ? (
              <Link href={`/labels?items=${product.id}:${Math.min(500, Math.ceil(Number(r.quantity)))}`} className={buttonClasses("primary", "xl")}>
                <Printer className="size-6" aria-hidden /> Print {Math.min(500, Math.ceil(Number(r.quantity)))} labels
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <a href="/receive" className={buttonClasses("success", "lg")}>
                <RotateCcw className="size-5" aria-hidden /> Receive more
              </a>
              <a href="/scan" className={buttonClasses("secondary", "lg")}>
                <ScanBarcode className="size-5" aria-hidden /> Scan next
              </a>
            </div>
          </>
        }
      />
    );
  }

  const total = Number(qty) > 0 && Number(cost) > 0 ? Number(qty) * Number(cost) : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="productId" value={product.id} />
      <ProductCard product={product} priceLabel="Last cost" price={product.purchasePrice} />
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Card className="space-y-4">
        <QuantityInput name="quantity" label="Quantity received" value={qty} onChange={setQty} unit={product.unit} error={fe?.quantity} autoFocus />
        <Field label="Purchase price per unit (₹)" name="unitCost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" error={fe?.unitCost} />
        <SelectField label="Supplier" name="supplierId" defaultValue={product.preferredSupplierId ?? ""} error={fe?.supplierId}>
          <option value="">Not specified</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </SelectField>
        {locations.length > 1 ? (
          <SelectField label="Location" name="locationId" defaultValue={locations.find((l) => l.isDefault)?.id} error={fe?.locationId}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </SelectField>
        ) : null}
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-brand-700">Bill number &amp; options</summary>
          <div className="mt-2 space-y-3">
            <Field label="Supplier bill / invoice no." name="invoiceNo" error={fe?.invoiceNo} autoComplete="off" />
            <label className="flex min-h-11 items-center gap-3">
              <input type="hidden" name="updateCost" value="false" />
              <input type="checkbox" name="updateCost" value="true" defaultChecked className="size-5 accent-brand-600" />
              Save this price as the product&apos;s purchase price
            </label>
          </div>
        </details>
      </Card>

      <div className="sticky bottom-20 z-10 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:px-0">
        {total > 0 ? <p className="mb-2 text-center text-sm text-ink-muted">Total value {formatMoney(total)}</p> : null}
        <SubmitButton pending={pending} variant="success" size="xl" className="w-full" pendingText="Saving…" disabled={!(Number(qty) > 0)}>
          <ArrowDownToLine className="size-6" aria-hidden />
          {Number(qty) > 0 ? `Confirm +${formatQty(qty)} ${product.unit}` : "Enter quantity"}
        </SubmitButton>
      </div>
    </form>
  );
}
