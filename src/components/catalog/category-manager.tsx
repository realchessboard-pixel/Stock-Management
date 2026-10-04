"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/catalog";

type Category = { id: string; name: string; description: string | null; productCount: number };

function AddCategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, fieldErrors, formError } = useFormAction(saveCategoryAction);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex items-start gap-2" noValidate>
      <Field label="New category" name="name" placeholder="e.g. Door Hardware" className="flex-1" error={fieldErrors?.name} autoComplete="off" />
      <SubmitButton pending={pending} className="mt-7 shrink-0" aria-label="Add category">
        <Plus className="size-5" aria-hidden /> Add
      </SubmitButton>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
    </form>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const save = useFormAction(saveCategoryAction);
  const del = useFormAction(deleteCategoryAction);
  // Editing ends when a NEW successful save result arrives (derived, no effect needed).
  const [editFrom, setEditFrom] = useState<{ state: typeof save.state } | null>(null);
  const editing = editFrom !== null && !(save.state?.ok && save.state !== editFrom.state);
  const setEditing = (on: boolean) => setEditFrom(on ? { state: save.state } : null);

  if (editing) {
    return (
      <li className="p-3">
        <form onSubmit={save.onSubmit} className="flex items-start gap-2" noValidate>
          <input type="hidden" name="id" value={category.id} />
          <Field label="Name" name="name" defaultValue={category.name} className="flex-1" error={save.fieldErrors?.name} autoFocus />
          <SubmitButton pending={save.pending} size="md" className="mt-7">Save</SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="mt-7 h-11 rounded-xl px-3 text-sm font-semibold text-ink-muted">
            Cancel
          </button>
        </form>
        {save.formError ? <Alert tone="error" className="mt-2">{save.formError}</Alert> : null}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate font-semibold">{category.name}</p>
        <p className="text-sm text-ink-muted">
          {category.productCount} {category.productCount === 1 ? "product" : "products"}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${category.name}`}
        className="flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas">
        <Pencil className="size-5" aria-hidden />
      </button>
      <form
        onSubmit={(e) => {
          const msg = category.productCount
            ? `Delete "${category.name}"? Its ${category.productCount} products will become uncategorised.`
            : `Delete "${category.name}"?`;
          if (!confirm(msg)) return e.preventDefault();
          del.onSubmit(e);
        }}
      >
        <input type="hidden" name="id" value={category.id} />
        <button type="submit" disabled={del.pending} aria-label={`Delete ${category.name}`}
          className="flex size-11 items-center justify-center rounded-lg text-danger-600 hover:bg-danger-50 disabled:opacity-50">
          <Trash2 className="size-5" aria-hidden />
        </button>
      </form>
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
        <AddCategoryForm />
      </div>
      {categories.length ? (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">No categories yet. Add your first one above, e.g. “Door Hardware”.</p>
      )}
    </div>
  );
}
