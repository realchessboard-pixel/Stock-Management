import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { NoAccess } from "@/components/common/no-access";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { getBusinessSettings } from "@/server/settings/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { ctx, allowed } = await pageAccess("business.settings");
  if (!allowed) return <NoAccess />;
  const settings = await getBusinessSettings(ctx);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      <SettingsForm settings={settings} />
      <Card className="mt-4 text-sm text-ink-muted">
        Plan: <span className="font-semibold text-ink">{settings.plan}</span> · Shop created {formatDate(settings.createdAt)}
      </Card>
    </div>
  );
}
