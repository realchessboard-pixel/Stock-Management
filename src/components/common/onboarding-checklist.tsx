import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import type { OnboardingStep } from "@/server/onboarding/progress";
import { cn } from "@/lib/cn";

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const nextIdx = steps.findIndex((s) => !s.done);
  return (
    <ol className="divide-y divide-line">
      {steps.map((s, i) => {
        const isNext = i === nextIdx;
        const content = (
          <>
            {s.done ? (
              <CheckCircle2 className="size-6 shrink-0 text-ok-600" aria-label="Done" />
            ) : (
              <Circle className={cn("size-6 shrink-0", isNext ? "text-brand-600" : "text-ink-faint")} aria-label="Not done" />
            )}
            <span className={cn("flex-1 text-base", s.done && "text-ink-muted line-through", isNext && "font-semibold")}>
              {s.label}
            </span>
            {!s.done && s.href ? <ChevronRight className="size-5 text-ink-faint" aria-hidden /> : null}
          </>
        );
        return (
          <li key={s.key}>
            {!s.done && s.href ? (
              <Link href={s.href} className="flex min-h-14 items-center gap-3 py-2">
                {content}
              </Link>
            ) : (
              <div className="flex min-h-14 items-center gap-3 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
