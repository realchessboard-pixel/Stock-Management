import "server-only";
import { AppError } from "@/lib/errors";
import type { AddUserInput } from "@/lib/validation/admin";
import { writeAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { assertWithinLimit } from "@/server/billing/entitlements";
import { db, type Tx } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import type { TenantContext } from "@/server/tenancy/context";

type RoleName = "OWNER" | "MANAGER" | "STAFF";

export async function listMembers(ctx: TenantContext) {
  const rows = await db.membership.findMany({
    where: { businessId: ctx.businessId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      role: true,
      isActive: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, isActive: true } },
    },
  });
  return rows.map((m) => ({ ...m.user, role: m.role, memberActive: m.isActive && m.user.isActive, joinedAt: m.createdAt }));
}
export type Member = Awaited<ReturnType<typeof listMembers>>[number];

/** Serialises membership changes per business so "last owner" checks can't race. */
async function lockBusiness(tx: Tx, businessId: string) {
  await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
}

async function getTarget(tx: Tx, ctx: TenantContext, userId: string) {
  const m = await tx.membership.findUnique({
    where: { businessId_userId: { businessId: ctx.businessId, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!m) throw new AppError("NOT_FOUND", "User not found in your shop.");
  return m;
}

async function assertNotLastOwner(tx: Tx, ctx: TenantContext, userId: string) {
  const owners = await tx.membership.count({ where: { businessId: ctx.businessId, role: "OWNER", isActive: true, NOT: { userId } } });
  if (owners === 0) throw new AppError("VALIDATION", "Your shop needs at least one active owner.");
}

async function endSessions(tx: Tx, businessId: string, userId: string) {
  await tx.session.deleteMany({ where: { businessId, userId } });
}

export async function addMember(ctx: TenantContext, input: AddUserInput) {
  await assertWithinLimit(ctx, "users");
  const contact = input.identifier.kind === "email" ? { email: input.identifier.value } : { phone: input.identifier.value };
  const existing = await db.user.findUnique({ where: contact, select: { id: true } });
  if (existing) {
    throw new AppError("ACCOUNT_EXISTS", "This email or phone already has a StockFlow account. Use a different one.", {
      fieldErrors: { identifier: ["Already registered"] },
    });
  }
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, passwordHash, ...contact } });
      await tx.membership.create({ data: { businessId: ctx.businessId, userId: user.id, role: input.role } });
      await writeAudit(tx, {
        businessId: ctx.businessId,
        userId: ctx.userId,
        action: "user.created",
        entityType: "User",
        entityId: user.id,
        metadata: { name: input.name, role: input.role, login: input.identifier.value },
      });
      return { id: user.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("ACCOUNT_EXISTS", undefined, { fieldErrors: { identifier: ["Already registered"] } });
    throw e;
  }
}

export async function changeMemberRole(ctx: TenantContext, userId: string, role: RoleName) {
  if (userId === ctx.userId) throw new AppError("VALIDATION", "You can't change your own role.");
  await db.$transaction(async (tx) => {
    await lockBusiness(tx, ctx.businessId);
    const m = await getTarget(tx, ctx, userId);
    if (m.role === role) return;
    if (m.role === "OWNER") await assertNotLastOwner(tx, ctx, userId);
    await tx.membership.update({ where: { id: m.id }, data: { role } });
    // Force a fresh login so the new permissions apply immediately everywhere.
    await endSessions(tx, ctx.businessId, userId);
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "user.role_changed",
      entityType: "User",
      entityId: userId,
      metadata: { name: m.user.name, from: m.role, to: role },
    });
  });
}

export async function setMemberActive(ctx: TenantContext, userId: string, active: boolean) {
  if (userId === ctx.userId) throw new AppError("VALIDATION", "You can't deactivate yourself.");
  await db.$transaction(async (tx) => {
    await lockBusiness(tx, ctx.businessId);
    const m = await getTarget(tx, ctx, userId);
    if (!active && m.role === "OWNER") await assertNotLastOwner(tx, ctx, userId);
    if (active && !m.isActive) await assertWithinLimit(ctx, "users");
    await tx.membership.update({ where: { id: m.id }, data: { isActive: active } });
    if (!active) await endSessions(tx, ctx.businessId, userId);
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: active ? "user.reactivated" : "user.deactivated",
      entityType: "User",
      entityId: userId,
      metadata: { name: m.user.name },
    });
  });
}

/**
 * Owner sets a new password for a staff member who forgot theirs. Only for
 * accounts that belong solely to this shop, so one shop can't take over a
 * person's access to another shop.
 */
export async function resetMemberPassword(ctx: TenantContext, userId: string, password: string) {
  if (userId === ctx.userId) throw new AppError("VALIDATION", "Use your own account settings to change your password.");
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const m = await getTarget(tx, ctx, userId);
    const otherShops = await tx.membership.count({ where: { userId, NOT: { businessId: ctx.businessId } } });
    if (otherShops) throw new AppError("FORBIDDEN", "This person also uses StockFlow for another shop, so only they can change their password.");
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "user.password_reset", entityType: "User", entityId: userId, metadata: { name: m.user.name } });
  });
}
