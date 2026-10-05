import { z } from "zod";
import { identifierSchema, optionalText, requiredText } from "./common";
import { passwordSchema } from "./auth";

const optionalId = z.preprocess((v) => (v === "" || v === "none" ? undefined : v), z.string().cuid().optional());

export const LOCATION_TYPES = ["STORE", "WAREHOUSE", "RACK", "BIN"] as const;
export const LOCATION_TYPE_LABEL: Record<(typeof LOCATION_TYPES)[number], string> = {
  STORE: "Shop / store",
  WAREHOUSE: "Warehouse / godown",
  RACK: "Rack / shelf",
  BIN: "Bin / box",
};

export const locationSchema = z.object({
  id: optionalId,
  name: requiredText("Location name", 60),
  code: optionalText(20),
  type: z.enum(LOCATION_TYPES).default("STORE"),
  parentId: optionalId,
});
/** Optional fields may be omitted by server-side callers (tests, imports). */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type LocationInput = WithOptional<z.infer<typeof locationSchema>, "code">;

export const ASSIGNABLE_ROLES = ["OWNER", "MANAGER", "STAFF"] as const;

export const addUserSchema = z.object({
  name: requiredText("Name", 120),
  identifier: identifierSchema,
  password: passwordSchema,
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choose a role" }),
});
export type AddUserInput = z.infer<typeof addUserSchema>;

export const changeRoleSchema = z.object({ userId: z.string().cuid(), role: z.enum(ASSIGNABLE_ROLES) });
export const memberStatusSchema = z.object({ userId: z.string().cuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });
export const resetPasswordSchema = z.object({ userId: z.string().cuid(), password: passwordSchema });

export const businessSettingsSchema = z.object({
  name: requiredText("Shop name", 120),
  ownerName: requiredText("Owner name", 120),
  phone: optionalText(20),
  email: optionalText(254).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  gstin: optionalText(15)
    .transform((v) => v?.toUpperCase())
    .refine((v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "GSTIN should look like 27ABCDE1234F1Z5"),
  address: optionalText(500),
  allowNegativeStock: z.preprocess((v) => {
    const last = Array.isArray(v) ? v[v.length - 1] : v;
    return last === "true" || last === "on";
  }, z.boolean()),
});
export type BusinessSettingsInput = WithOptional<z.infer<typeof businessSettingsSchema>, "phone" | "email" | "gstin" | "address">;
