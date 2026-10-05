"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addUserSchema, businessSettingsSchema, changeRoleSchema, locationSchema, memberStatusSchema, resetPasswordSchema } from "@/lib/validation/admin";
import { saveLocation, setDefaultLocation, setLocationActive } from "@/server/locations/service";
import { updateBusinessSettings } from "@/server/settings/service";
import { addMember, changeMemberRole, resetMemberPassword, setMemberActive } from "@/server/users/service";
import { tenantAction } from "./safe-action";

const idSchema = z.object({ id: z.string().cuid() });

// ── Locations (managers and owners) ──
export const saveLocationAction = tenantAction({ schema: locationSchema, permission: "location.write" }, async (ctx, input) => {
  const r = await saveLocation(ctx, input);
  revalidatePath("/locations");
  return r;
});
export const setDefaultLocationAction = tenantAction({ schema: idSchema, permission: "location.write" }, async (ctx, { id }) => {
  await setDefaultLocation(ctx, id);
  revalidatePath("/locations");
  return { id };
});
export const toggleLocationAction = tenantAction(
  { schema: idSchema.extend({ active: z.enum(["true", "false"]).transform((v) => v === "true") }), permission: "location.write" },
  async (ctx, { id, active }) => {
    await setLocationActive(ctx, id, active);
    revalidatePath("/locations");
    return { id };
  },
);

// ── Users (owners only) ──
export const addUserAction = tenantAction({ schema: addUserSchema, permission: "user.manage" }, async (ctx, input) => {
  const r = await addMember(ctx, input);
  revalidatePath("/users");
  return r;
});
export const changeRoleAction = tenantAction({ schema: changeRoleSchema, permission: "user.manage" }, async (ctx, { userId, role }) => {
  await changeMemberRole(ctx, userId, role);
  revalidatePath("/users");
  return { userId };
});
export const memberStatusAction = tenantAction({ schema: memberStatusSchema, permission: "user.manage" }, async (ctx, { userId, active }) => {
  await setMemberActive(ctx, userId, active);
  revalidatePath("/users");
  return { userId };
});
export const resetPasswordAction = tenantAction({ schema: resetPasswordSchema, permission: "user.manage" }, async (ctx, { userId, password }) => {
  await resetMemberPassword(ctx, userId, password);
  return { userId };
});

// ── Business settings (owners only) ──
export const updateSettingsAction = tenantAction({ schema: businessSettingsSchema, permission: "business.settings" }, async (ctx, input) => {
  await updateBusinessSettings(ctx, input);
  revalidatePath("/", "layout");
  return { ok: true };
});
