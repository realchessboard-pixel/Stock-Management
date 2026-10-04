"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// Never show error.message/stack here: it may contain internals.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description="This page couldn't load. Your stock data is safe. Please try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
