"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useFormAction } from "@/hooks/use-form-action";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { archiveProductAction, restoreProductAction } from "@/server/actions/catalog";

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const { pending, onSubmit, formError } = useFormAction(archived ? restoreProductAction : archiveProductAction);
  return (
    <form
      onSubmit={(e) => {
        if (!archived && !confirm("Archive this product? It will be hidden from lists and scanning. Stock history is kept.")) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
    >
      <input type="hidden" name="id" value={id} />
      {formError ? <Alert tone="error" className="mb-2">{formError}</Alert> : null}
      <SubmitButton pending={pending} variant="secondary" size="md" className="w-full">
        {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {archived ? "Restore product" : "Archive product"}
      </SubmitButton>
    </form>
  );
}
