import { beforeEach, describe, expect, it } from "vitest";
import { addUserSchema } from "@/lib/validation/admin";
import { authenticate } from "@/server/business/accounts";
import { db } from "@/server/db";
import { listLocations, saveLocation, setDefaultLocation, setLocationActive } from "@/server/locations/service";
import { updateBusinessSettings } from "@/server/settings/service";
import { addMember, changeMemberRole, listMembers, resetMemberPassword, setMemberActive } from "@/server/users/service";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";
import { makeProduct, onHand, receive, sell } from "../helpers/stock";

const newUser = (overrides: Record<string, unknown> = {}) =>
  addUserSchema.parse({ name: "Ramesh", identifier: "98765 11111", password: "staffpass1", role: "STAFF", ...overrides });

describe("user management", () => {
  let owner: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    owner = await createTenant("Sharma Hardware");
  });

  it("adds a staff user who can log in, and audits it", async () => {
    const { id } = await addMember(owner, newUser());
    const members = await listMembers(owner);
    expect(members.map((m) => [m.name, m.role])).toContainEqual(["Ramesh", "STAFF"]);
    await expect(authenticate({ identifier: { kind: "phone", value: "+919876511111" }, password: "staffpass1" })).resolves.toEqual({
      userId: id,
      businessId: owner.businessId,
    });
    expect(await db.auditLog.count({ where: { action: "user.created", entityId: id } })).toBe(1);
  });

  it("refuses an email/phone that already has an account", async () => {
    await addMember(owner, newUser());
    await expect(addMember(owner, newUser({ name: "Other" }))).rejects.toMatchObject({ code: "ACCOUNT_EXISTS" });
  });

  it("changing a role logs the user out and records from/to", async () => {
    const { id } = await addMember(owner, newUser());
    await db.session.create({ data: { tokenHash: "h1", userId: id, businessId: owner.businessId, expiresAt: new Date(Date.now() + 1e7) } });
    await changeMemberRole(owner, id, "MANAGER");
    expect(await db.session.count({ where: { userId: id } })).toBe(0);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "user.role_changed", entityId: id } });
    expect(log.metadata).toMatchObject({ from: "STAFF", to: "MANAGER" });
  });

  it("protects the last owner and the current user", async () => {
    await expect(changeMemberRole(owner, owner.userId, "STAFF")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setMemberActive(owner, owner.userId, false)).rejects.toMatchObject({ code: "VALIDATION" });
    const { id } = await addMember(owner, newUser({ role: "OWNER" }));
    // Second owner can be demoted because the first remains.
    await changeMemberRole(owner, id, "MANAGER");
    expect((await listMembers(owner)).filter((m) => m.role === "OWNER")).toHaveLength(1);
  });

  it("deactivated users cannot log in; reactivation restores access", async () => {
    const { id } = await addMember(owner, newUser());
    await setMemberActive(owner, id, false);
    const login = { identifier: { kind: "phone" as const, value: "+919876511111" }, password: "staffpass1" };
    await expect(authenticate(login)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await setMemberActive(owner, id, true);
    await expect(authenticate(login)).resolves.toBeTruthy();
  });

  it("owner can reset a staff password; old password stops working", async () => {
    const { id } = await addMember(owner, newUser());
    await resetMemberPassword(owner, id, "brandnewpw");
    await expect(authenticate({ identifier: { kind: "phone", value: "+919876511111" }, password: "staffpass1" })).rejects.toBeTruthy();
    await expect(authenticate({ identifier: { kind: "phone", value: "+919876511111" }, password: "brandnewpw" })).resolves.toBeTruthy();
  });

  it("one shop's owner cannot manage another shop's users", async () => {
    const { id } = await addMember(owner, newUser());
    const other = await createTenant("Other");
    await expect(changeMemberRole(other, id, "OWNER")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setMemberActive(other, id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(resetMemberPassword(other, id, "hijacked1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listMembers(other)).map((m) => m.id)).not.toContain(id);
  });
});

describe("locations", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    ctx = await createTenant("Sharma Hardware");
  });

  it("creates racks inside a warehouse and receives stock into a specific location", async () => {
    const { id: godown } = await saveLocation(ctx, { name: "Godown", type: "WAREHOUSE" });
    const { id: rackA } = await saveLocation(ctx, { name: "Rack A", type: "RACK", parentId: godown });
    await expect(saveLocation(ctx, { name: "rack a", type: "RACK", parentId: godown })).rejects.toMatchObject({ code: "DUPLICATE" });
    const p = await makeProduct(ctx, "5");
    await receive(ctx, p, "7", { locationId: rackA });
    expect(await onHand(p)).toBe(12);
    const locs = await listLocations(ctx);
    expect(locs.find((l) => l.id === rackA)).toMatchObject({ parentName: "Godown", products: 1, units: 7 });
  });

  it("switches the default location and refuses to turn off a default or stocked location", async () => {
    const main = (await listLocations(ctx))[0];
    const { id: rack } = await saveLocation(ctx, { name: "Rack B", type: "RACK" });
    const p = await makeProduct(ctx, "0");
    await receive(ctx, p, "3", { locationId: rack });
    await expect(setLocationActive(ctx, main.id, false)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setLocationActive(ctx, rack, false)).rejects.toMatchObject({ code: "VALIDATION" });
    await setDefaultLocation(ctx, rack);
    const after = await listLocations(ctx);
    expect(after.filter((l) => l.isDefault).map((l) => l.id)).toEqual([rack]);
    await setLocationActive(ctx, main.id, false);
    await expect(receive(ctx, p, "1", { locationId: main.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("can't use another business's location", async () => {
    const other = await createTenant("Other");
    const foreign = (await listLocations(other))[0];
    await expect(saveLocation(ctx, { name: "X", type: "RACK", parentId: foreign.id })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setDefaultLocation(ctx, foreign.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("business settings", () => {
  beforeEach(resetDatabase);

  it("the negative-stock switch controls the engine and is audited", async () => {
    const ctx = await createTenant("Shop");
    const p = await makeProduct(ctx, "1");
    await expect(sell(ctx, p, "2")).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await updateBusinessSettings(ctx, { name: "Shop", ownerName: "Owner of Shop", allowNegativeStock: true });
    await sell(ctx, p, "2");
    expect(await onHand(p)).toBe(-1);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "business.updated" } });
    expect(log.metadata).toMatchObject({ changed: { allowNegativeStock: { from: false, to: true } } });
  });
});
