import "server-only";
import { AppError } from "@/lib/errors";
import type { LoginInput, SignupInput } from "@/lib/validation/auth";
import { writeAudit } from "@/server/audit";
import { dummyVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";

export const DEFAULT_LOCATION_NAME = "Main Store";

/**
 * Creates a new tenant: business + owner user + OWNER membership + the
 * default stock location, atomically.
 */
export async function registerBusiness(input: SignupInput, meta: { ip?: string | null } = {}) {
  const passwordHash = await hashPassword(input.password);
  const contact = input.identifier.kind === "email" ? { email: input.identifier.value } : { phone: input.identifier.value };

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.ownerName, passwordHash, ...contact } });
      const business = await tx.business.create({
        data: { name: input.businessName, ownerName: input.ownerName, ...contact },
      });
      await tx.membership.create({ data: { businessId: business.id, userId: user.id, role: "OWNER" } });
      await tx.stockLocation.create({
        data: { businessId: business.id, name: DEFAULT_LOCATION_NAME, type: "STORE", isDefault: true },
      });
      await writeAudit(tx, {
        businessId: business.id,
        userId: user.id,
        action: "business.created",
        entityType: "Business",
        entityId: business.id,
        metadata: { name: business.name },
        ip: meta.ip,
      });
      return { userId: user.id, businessId: business.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("ACCOUNT_EXISTS");
    throw e;
  }
}

/**
 * Verifies credentials and picks the business to sign into (the user's
 * oldest active membership). Generic error for unknown user or wrong
 * password, with equalised timing, to avoid account enumeration.
 */
export async function authenticate(input: LoginInput) {
  const where = input.identifier.kind === "email" ? { email: input.identifier.value } : { phone: input.identifier.value };
  const user = await db.user.findUnique({ where });
  if (!user || !user.isActive) {
    await dummyVerify(input.password);
    throw new AppError("INVALID_CREDENTIALS");
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw new AppError("INVALID_CREDENTIALS");

  const membership = await db.membership.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new AppError("INVALID_CREDENTIALS");

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { userId: user.id, businessId: membership.businessId };
}
