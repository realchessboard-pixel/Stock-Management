"use client";

import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextareaField } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { updateSettingsAction } from "@/server/actions/admin";

type Settings = {
  name: string;
  ownerName: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  allowNegativeStock: boolean;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(updateSettingsAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {state?.ok ? <Alert tone="success">Settings saved.</Alert> : null}
      <Card className="space-y-4">
        <h2 className="font-semibold">Shop details</h2>
        <Field label="Shop name" name="name" defaultValue={settings.name} error={fe?.name} />
        <Field label="Owner name" name="ownerName" defaultValue={settings.ownerName} error={fe?.ownerName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" name="phone" type="tel" defaultValue={settings.phone ?? ""} error={fe?.phone} />
          <Field label="Email" name="email" type="email" defaultValue={settings.email ?? ""} error={fe?.email} />
        </div>
        <Field label="GSTIN" name="gstin" defaultValue={settings.gstin ?? ""} autoCapitalize="characters" error={fe?.gstin} />
        <TextareaField label="Address" name="address" defaultValue={settings.address ?? ""} error={fe?.address} />
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Stock rules</h2>
        <label className="flex min-h-12 items-start gap-3">
          <input type="hidden" name="allowNegativeStock" value="false" />
          <input type="checkbox" name="allowNegativeStock" value="true" defaultChecked={settings.allowNegativeStock} className="mt-1 size-5 accent-brand-600" />
          <span>
            <span className="font-medium">Allow negative stock</span>
            <span className="block text-sm text-ink-muted">
              Lets staff record stock going out even when StockFlow shows zero. Leave this off unless you often sell before receiving stock in the app.
            </span>
          </span>
        </label>
      </Card>
      <SubmitButton pending={pending} size="xl" className="w-full" pendingText="Saving…">
        Save settings
      </SubmitButton>
    </form>
  );
}
