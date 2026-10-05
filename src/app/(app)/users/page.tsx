import type { Metadata } from "next";
import { UserManager } from "@/components/admin/user-manager";
import { NoAccess } from "@/components/common/no-access";
import { PageHeader } from "@/components/ui/page-header";
import { listMembers } from "@/server/users/service";
import { pageAccess } from "@/server/tenancy/page-guard";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const { ctx, allowed } = await pageAccess("user.manage");
  if (!allowed) return <NoAccess />;
  const members = await listMembers(ctx);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Users" subtitle="People who can use StockFlow for your shop." />
      <UserManager members={members} currentUserId={ctx.userId} />
    </div>
  );
}
