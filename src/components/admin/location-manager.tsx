"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Plus, Power, Star } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { formatQty } from "@/lib/format";
import { LOCATION_TYPE_LABEL, LOCATION_TYPES } from "@/lib/validation/admin";
import { saveLocationAction, setDefaultLocationAction, toggleLocationAction } from "@/server/actions/admin";
import { InlineAction } from "./inline-action";

type Loc = {
  id: string;
  name: string;
  code: string | null;
  type: (typeof LOCATION_TYPES)[number];
  parentId: string | null;
  parentName: string | null;
  isDefault: boolean;
  isActive: boolean;
  products: number;
  units: number;
};

function LocationForm({ locations, initial, onDone }: { locations: Loc[]; initial?: Loc; onDone?: () => void }) {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(saveLocationAction);
  useEffect(() => {
    if (state?.ok) {
      if (!initial) ref.current?.reset();
      onDone?.();
    }
  }, [state, initial, onDone]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={initial?.name} placeholder="e.g. Rack A or Godown" error={fe?.name} autoComplete="off" />
        <SelectField label="Type" name="type" defaultValue={initial?.type ?? "RACK"} error={fe?.type}>
          {LOCATION_TYPES.map((t) => (
            <option key={t} value={t}>{LOCATION_TYPE_LABEL[t]}</option>
          ))}
        </SelectField>
        <SelectField label="Inside (optional)" name="parentId" defaultValue={initial?.parentId ?? ""} error={fe?.parentId}>
          <option value="">— Top level —</option>
          {locations.filter((l) => l.id !== initial?.id && l.isActive).map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </SelectField>
        <Field label="Short code (optional)" name="code" defaultValue={initial?.code ?? ""} placeholder="e.g. A1" error={fe?.code} autoComplete="off" />
      </div>
      <SubmitButton pending={pending} size="md" className="w-full sm:w-auto">
        {initial ? "Save" : <><Plus className="size-4" aria-hidden /> Add location</>}
      </SubmitButton>
    </form>
  );
}

export function LocationManager({ locations }: { locations: Loc[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Add a location</h2>
        <LocationForm locations={locations} />
      </div>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
        {locations.map((l) => (
          <li key={l.id} className="p-4">
            {editing === l.id ? (
              <LocationForm locations={locations} initial={l} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <MapPin className="size-5 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {l.name} {l.code ? <span className="font-mono text-sm text-ink-muted">({l.code})</span> : null}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {LOCATION_TYPE_LABEL[l.type]}
                    {l.parentName ? ` · in ${l.parentName}` : ""} · {l.products} products · {formatQty(l.units)} units
                  </p>
                  <div className="mt-1 flex gap-2">
                    {l.isDefault ? <Badge tone="brand">Default</Badge> : null}
                    {!l.isActive ? <Badge>Inactive</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => setEditing(l.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-muted hover:bg-canvas">
                    <Pencil className="size-4" aria-hidden /> Edit
                  </button>
                  {!l.isDefault && l.isActive ? (
                    <InlineAction action={setDefaultLocationAction} fields={{ id: l.id }} className="text-brand-700 hover:bg-brand-50">
                      <Star className="size-4" aria-hidden /> Make default
                    </InlineAction>
                  ) : null}
                  {!l.isDefault ? (
                    <InlineAction action={toggleLocationAction} fields={{ id: l.id, active: String(!l.isActive) }}
                      className={l.isActive ? "text-danger-600 hover:bg-danger-50" : "text-ok-700 hover:bg-ok-50"}
                      confirmText={l.isActive ? `Turn off "${l.name}"? It must have no stock.` : undefined}>
                      <Power className="size-4" aria-hidden /> {l.isActive ? "Turn off" : "Turn on"}
                    </InlineAction>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">
        The default location is used when receiving or removing stock. When you have more than one location, the stock screens let you pick.
      </p>
    </div>
  );
}
