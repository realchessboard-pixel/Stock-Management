import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      description="This page or record doesn't exist, or it belongs to another shop."
      action={<ButtonLink href="/dashboard">Go to dashboard</ButtonLink>}
    />
  );
}
