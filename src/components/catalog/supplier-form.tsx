"use client";

import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextareaField } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { saveSupplierAction } from "@/server/actions/catalog";

export type SupplierDefaults = {
  id?: string;
  name?: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export function SupplierForm({ defaults = {} }: { defaults?: SupplierDefaults }) {
  const { pending, onSubmit, fieldErrors: fe, formError } = useFormAction(saveSupplierAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Card className="space-y-4">
        <Field label="Supplier name" name="name" defaultValue={defaults.name} required autoFocus={!defaults.id} error={fe?.name} placeholder="e.g. Ravi Kumar" />
        <Field label="Company" name="company" defaultValue={defaults.company ?? ""} error={fe?.company} placeholder="e.g. Ravi Traders" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone ?? ""} error={fe?.phone} />
          <Field label="Email" name="email" type="email" inputMode="email" defaultValue={defaults.email ?? ""} error={fe?.email} />
        </div>
        <Field label="GSTIN" name="gstin" defaultValue={defaults.gstin ?? ""} autoCapitalize="characters" error={fe?.gstin} placeholder="27ABCDE1234F1Z5" />
        <TextareaField label="Address" name="address" defaultValue={defaults.address ?? ""} error={fe?.address} />
        <TextareaField label="Notes" name="notes" defaultValue={defaults.notes ?? ""} error={fe?.notes} />
        {defaults.id ? (
          <label className="flex min-h-12 items-center gap-3 text-base">
            <input type="hidden" name="isActive" value="false" />
            <input type="checkbox" name="isActive" value="true" defaultChecked={defaults.isActive ?? true} className="size-5 accent-brand-600" />
            Active supplier
          </label>
        ) : null}
      </Card>
      <SubmitButton pending={pending} size="xl" className="w-full" pendingText="Saving…">
        {defaults.id ? "Save changes" : "Save supplier"}
      </SubmitButton>
    </form>
  );
}
