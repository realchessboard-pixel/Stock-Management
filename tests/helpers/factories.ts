import { randomUUID } from "node:crypto";
import type { RoleName } from "@/lib/permissions";
import { registerBusiness } from "@/server/business/accounts";
import { db } from "@/server/db";
import type { TenantContext } from "@/server/tenancy/context";

let counter = 0;

/** Creates a business with an owner via the real signup service and returns its context. */
export async function createTenant(name = `Shop ${++counter}`): Promise<TenantContext> {
  const email = `owner-${randomUUID()}@test.local`;
  const { userId, businessId } = await registerBusiness({
    businessName: name,
    ownerName: `Owner of ${name}`,
    identifier: { kind: "email", value: email },
    password: "correct horse battery",
  });
  return {
    businessId,
    userId,
    role: "OWNER",
    sessionId: "test",
    userName: `Owner of ${name}`,
    businessName: name,
    allowNegativeStock: false,
  };
}

/** Adds a member with the given role to an existing tenant. */
export async function addMember(owner: TenantContext, role: RoleName): Promise<TenantContext> {
  const user = await db.user.create({
    data: { name: `${role} user`, email: `${role.toLowerCase()}-${randomUUID()}@test.local`, passwordHash: "x" },
  });
  await db.membership.create({ data: { businessId: owner.businessId, userId: user.id, role } });
  return { ...owner, userId: user.id, role, userName: user.name };
}
