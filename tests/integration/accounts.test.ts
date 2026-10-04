import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, DEFAULT_LOCATION_NAME, registerBusiness } from "@/server/business/accounts";
import { db } from "@/server/db";
import { resetDatabase } from "../helpers/db";

const signup = {
  businessName: "Sharma Hardware",
  ownerName: "Ravi Sharma",
  identifier: { kind: "phone" as const, value: "+919876543210" },
  password: "correct horse battery",
};

describe("business registration", () => {
  beforeEach(resetDatabase);

  it("creates business, owner, OWNER membership, default location and audit entry atomically", async () => {
    const { businessId, userId } = await registerBusiness(signup);
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    expect(business.name).toBe("Sharma Hardware");
    expect(business.allowNegativeStock).toBe(false);
    expect(business.plan).toBe("FREE");

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).not.toContain("correct horse");
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);

    const membership = await db.membership.findFirstOrThrow({ where: { businessId, userId } });
    expect(membership.role).toBe("OWNER");

    const locations = await db.stockLocation.findMany({ where: { businessId } });
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ name: DEFAULT_LOCATION_NAME, isDefault: true });

    expect(await db.auditLog.count({ where: { businessId, action: "business.created" } })).toBe(1);
  });

  it("rejects a duplicate account and leaves no orphan business behind", async () => {
    await registerBusiness(signup);
    await expect(registerBusiness({ ...signup, businessName: "Other" })).rejects.toMatchObject({ code: "ACCOUNT_EXISTS" });
    expect(await db.business.count()).toBe(1);
  });
});

describe("authentication", () => {
  beforeEach(resetDatabase);

  it("accepts the right password and returns the user's business", async () => {
    const created = await registerBusiness(signup);
    await expect(authenticate({ identifier: signup.identifier, password: signup.password })).resolves.toEqual(created);
  });

  it("rejects a wrong password and an unknown user with the same generic error", async () => {
    await registerBusiness(signup);
    await expect(authenticate({ identifier: signup.identifier, password: "wrong password" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      authenticate({ identifier: { kind: "email", value: "nobody@x.in" }, password: "whatever1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rejects deactivated users", async () => {
    const { userId } = await registerBusiness(signup);
    await db.user.update({ where: { id: userId }, data: { isActive: false } });
    await expect(authenticate({ identifier: signup.identifier, password: signup.password })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });
});
