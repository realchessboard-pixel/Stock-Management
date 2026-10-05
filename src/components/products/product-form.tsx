"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextareaField } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { PhotoInput } from "./photo-input";
import { cn } from "@/lib/cn";
import { GST_RATES, UNITS } from "@/lib/validation/catalog";
import { createProductAction, updateProductAction } from "@/server/actions/catalog";

export type ProductFormDefaults = {
  id?: string;
  name?: string;
  sku?: string;
  unit?: string;
  categoryId?: string | null;
  brandName?: string | null;
  preferredSupplierId?: string | null;
  purchasePrice?: string;
  sellingPrice?: string;
  mrp?: string;
  gstRate?: string;
  hsnSac?: string | null;
  minStock?: string;
  description?: string | null;
  imageUrl?: string | null;
  barcode?: { code: string; kind: string } | null;
};

type Option = { id: string; name: string };

const BARCODE_MODES = [
  { value: "generate", label: "Generate", hint: "We create a Code 128 barcode you can print." },
  { value: "existing", label: "Already has one", hint: "Type the barcode printed on the product." },
  { value: "none", label: "No barcode", hint: "You can add one later." },
] as const;

export function ProductForm({
  mode,
  defaults = {},
  idempotencyKey,
  categories,
  brands,
  suppliers,
  initialBarcode,
  locations = [],
}: {
  mode: "create" | "edit";
  defaults?: ProductFormDefaults;
  idempotencyKey?: string;
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  initialBarcode?: string;
  locations?: { id: string; name: string; isDefault: boolean }[];
}) {
  const router = useRouter();
  const action = mode === "create" ? createProductAction : updateProductAction;
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(action);

  const initialMode = initialBarcode
    ? "existing"
    : defaults.barcode
      ? defaults.barcode.kind === "GENERATED"
        ? "generate"
        : "existing"
      : mode === "create"
        ? "generate"
        : "none";
  const [barcodeMode, setBarcodeMode] = useState<(typeof BARCODE_MODES)[number]["value"]>(initialMode);

  useEffect(() => {
    if (state?.ok) {
      router.push(`/products/${state.data.id}?saved=${mode === "create" ? "created" : "updated"}`);
    }
  }, [state, router, mode]);

  const hasErrorsInMore = Boolean(fe?.sku || fe?.description || fe?.preferredSupplierId || fe?.imageUrl || fe?.hsnSac);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {idempotencyKey ? <input type="hidden" name="idempotencyKey" value={idempotencyKey} /> : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {fe && !formError ? <Alert tone="error">Please fix the highlighted fields.</Alert> : null}

      <Card className="space-y-4">
        <Field label="Product name" name="name" defaultValue={defaults.name} placeholder='e.g. SS Tower Bolt 4"' required autoFocus={mode === "create"} error={fe?.name} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Category" name="categoryId" defaultValue={defaults.categoryId ?? ""} error={fe?.categoryId}
            hint={<Link href="/categories" className="text-brand-700 underline">Manage categories</Link>}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          <SelectField label="Unit" name="unit" defaultValue={defaults.unit ?? "pcs"} error={fe?.unit}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </SelectField>
        </div>
        <Field label="Brand" name="brandName" list="brand-options" defaultValue={defaults.brandName ?? ""} placeholder="Type or pick a brand" autoComplete="off" error={fe?.brandName} />
        <datalist id="brand-options">
          {brands.map((b) => (
            <option key={b.id} value={b.name} />
          ))}
        </datalist>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Prices</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price (₹)" name="purchasePrice" inputMode="decimal" defaultValue={defaults.purchasePrice ?? ""} placeholder="0" error={fe?.purchasePrice} />
          <Field label="Selling price (₹)" name="sellingPrice" inputMode="decimal" defaultValue={defaults.sellingPrice ?? ""} placeholder="0" error={fe?.sellingPrice} />
          <Field label="MRP (₹)" name="mrp" inputMode="decimal" defaultValue={defaults.mrp ?? ""} placeholder="Optional" error={fe?.mrp} />
          <SelectField label="GST rate" name="gstRate" defaultValue={defaults.gstRate ?? "18"} error={fe?.gstRate}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold">Stock</h2>
        {mode === "create" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening stock" name="openingQuantity" inputMode="decimal" placeholder="0"
              hint="How many you have right now." error={fe?.openingQuantity} />
            {locations.length > 1 ? (
              <SelectField label="Kept at" name="openingLocationId" defaultValue={locations.find((l) => l.isDefault)?.id} error={fe?.openingLocationId}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </SelectField>
            ) : null}
          </div>
        ) : null}
        <Field label="Minimum stock" name="minStock" inputMode="decimal" defaultValue={defaults.minStock ?? ""} placeholder="0"
          hint="We'll warn you when stock goes below this." error={fe?.minStock} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Barcode</h2>
        <div role="radiogroup" aria-label="Barcode" className="grid grid-cols-3 gap-2">
          {BARCODE_MODES.map((m) => (
            <label
              key={m.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold",
                barcodeMode === m.value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-muted",
              )}
            >
              <input type="radio" name="barcodeMode" value={m.value} checked={barcodeMode === m.value} onChange={() => setBarcodeMode(m.value)} className="sr-only" />
              {m.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-ink-muted">{BARCODE_MODES.find((m) => m.value === barcodeMode)?.hint}</p>
        {barcodeMode === "generate" && defaults.barcode?.kind === "GENERATED" ? (
          <p className="text-sm">Current: <span className="font-mono font-semibold">{defaults.barcode.code}</span></p>
        ) : null}
        {barcodeMode === "existing" ? (
          <Field label="Barcode number" name="barcode" defaultValue={initialBarcode ?? (defaults.barcode?.kind !== "GENERATED" ? defaults.barcode?.code : "")}
            inputMode="text" autoComplete="off" autoCapitalize="characters" placeholder="e.g. 8901234567890" error={fe?.barcode}
            hint="Tip: a USB/Bluetooth scanner can type it here." />
        ) : null}
      </Card>

      <details className="group rounded-[var(--radius-card)] border border-line bg-surface shadow-sm" open={hasErrorsInMore || undefined}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold">
          More details <span className="text-sm font-normal text-ink-muted group-open:hidden">Photo, SKU, supplier, HSN</span>
        </summary>
        <div className="space-y-4 border-t border-line p-4">
          <Field label="SKU" name="sku" defaultValue={defaults.sku ?? ""} placeholder={mode === "create" ? "Leave blank to auto-generate" : ""} autoCapitalize="characters" autoComplete="off" error={fe?.sku} />
          <SelectField label="Preferred supplier" name="preferredSupplierId" defaultValue={defaults.preferredSupplierId ?? ""} error={fe?.preferredSupplierId}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectField>
          <Field label="HSN / SAC code" name="hsnSac" inputMode="numeric" defaultValue={defaults.hsnSac ?? ""} placeholder="e.g. 8302" error={fe?.hsnSac} />
          <TextareaField label="Description" name="description" defaultValue={defaults.description ?? ""} error={fe?.description} />
          <PhotoInput name="imageUrl" defaultValue={defaults.imageUrl} error={fe?.imageUrl} />
        </div>
      </details>

      <div className="sticky-actions sticky bottom-20 z-10 -mx-4 bg-canvas/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:px-0">
        <SubmitButton pending={pending || state?.ok === true} size="xl" className="w-full" pendingText="Saving…">
          {mode === "create" ? "Save product" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
