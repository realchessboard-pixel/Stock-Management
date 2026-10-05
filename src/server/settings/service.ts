import "server-only";
import type { BusinessSettingsInput } from "@/lib/validation/admin";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

export async function getBusinessSettings(ctx: TenantContext) {
  return db.business.findUniqueOrThrow({
    where: { id: ctx.businessId },
    select: { name: true, ownerName: true, phone: true, email: true, gstin: true, address: true, allowNegativeStock: true, plan: true, createdAt: true },
  });
}

export async function updateBusinessSettings(ctx: TenantContext, input: BusinessSettingsInput) {
  await db.$transaction(async (tx) => {
    const before = await tx.business.findUniqueOrThrow({ where: { id: ctx.businessId } });
    const data = {
      name: input.name,
      ownerName: input.ownerName,
      phone: input.phone ?? null,
      email: input.email?.toLowerCase() ?? null,
      gstin: input.gstin ?? null,
      address: input.address ?? null,
      allowNegativeStock: input.allowNegativeStock,
    };
    await tx.business.update({ where: { id: ctx.businessId }, data });
    const changed = Object.fromEntries(
      Object.entries(data)
        .filter(([k, v]) => (before as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => [k, { from: (before as Record<string, unknown>)[k] ?? null, to: v }]),
    );
    if (Object.keys(changed).length) {
      await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "business.updated", entityType: "Business", entityId: ctx.businessId, metadata: { changed } });
    }
  });
}
