import { Hammer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/** Temporary placeholder for sections scheduled in a later build phase. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={Hammer}
        title="Being built"
        description="This section is part of the next StockFlow update."
        action={<ButtonLink href="/dashboard" variant="secondary">Back to dashboard</ButtonLink>}
      />
    </>
  );
}
