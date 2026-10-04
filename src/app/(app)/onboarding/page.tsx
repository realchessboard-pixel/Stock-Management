import type { Metadata } from "next";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getOnboardingProgress } from "@/server/onboarding/progress";
import { requirePageContext } from "@/server/tenancy/context";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const ctx = await requirePageContext();
  const { steps, complete } = await getOnboardingProgress(ctx);
  const next = steps.find((s) => !s.done);
  return (
    <>
      <PageHeader title={`Welcome, ${ctx.userName.split(" ")[0]}!`} subtitle={`${ctx.businessName} is ready. A few quick steps to start.`} />
      <Card>
        <OnboardingChecklist steps={steps} />
      </Card>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {next?.href ? (
          <ButtonLink href={next.href} size="xl" className="flex-1">
            {next.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/dashboard" variant={complete ? "primary" : "secondary"} size="xl" className="flex-1">
          {complete ? "Go to dashboard" : "Skip for now"}
        </ButtonLink>
      </div>
    </>
  );
}
