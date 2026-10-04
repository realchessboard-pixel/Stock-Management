import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function NoAccess() {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access"
      description="Your role doesn't include this section. Ask the shop owner if you need it."
      action={<ButtonLink href="/dashboard">Back to dashboard</ButtonLink>}
    />
  );
}
