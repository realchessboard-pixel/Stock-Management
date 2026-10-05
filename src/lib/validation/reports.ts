import { z } from "zod";
import { MOVEMENT_TYPES } from "@/lib/movements";

const optional = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" || v === undefined || Array.isArray(v) ? undefined : v), s.optional()).catch(undefined);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const movementFilterSchema = z.object({
  productId: optional(z.string().cuid()),
  q: optional(z.string().trim().max(100)),
  type: optional(z.enum(MOVEMENT_TYPES)),
  direction: optional(z.enum(["IN", "OUT"])),
  userId: optional(z.string().cuid()),
  locationId: optional(z.string().cuid()),
  from: optional(dateKey),
  to: optional(dateKey),
  page: z.coerce.number().int().min(1).max(100_000).default(1).catch(1),
});
export type MovementFilter = z.infer<typeof movementFilterSchema>;

export const inventoryFilterSchema = z.object({
  q: optional(z.string().trim().max(100)),
  status: z.enum(["all", "attention", "low", "out", "in"]).default("all").catch("all"),
  locationId: optional(z.string().cuid()),
  categoryId: optional(z.string().cuid()),
  sort: z.enum(["name", "qty", "-qty", "-value", "shortage"]).default("name").catch("name"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;

/** Flattens Next.js searchParams (string | string[]) into a plain object. */
export function flatParams(sp: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
