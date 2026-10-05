import { z } from "zod";
import { ADJUSTMENT_TYPES } from "@/lib/movements";
import { optionalText } from "./common";
import { optionalMoney, quantity, quantityOrZero } from "./numbers";

const id = z.string().cuid();
const optionalId = z.preprocess((v) => (v === "" ? undefined : v), id.optional());
const key = z.string().uuid("Please reload the page and try again");

export const receiveStockSchema = z.object({
  idempotencyKey: key,
  productId: id,
  quantity: quantity("Quantity received"),
  unitCost: optionalMoney("Purchase price"),
  supplierId: optionalId,
  locationId: optionalId,
  invoiceNo: optionalText(60),
  updateCost: z.preprocess((v) => (Array.isArray(v) ? v[v.length - 1] : v) === "true" || v === "on", z.boolean()).default(false),
});
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export const stockOutSchema = z.object({
  idempotencyKey: key,
  productId: id,
  quantity: quantity("Quantity"),
  locationId: optionalId,
  note: optionalText(200),
});
export type StockOutInput = z.infer<typeof stockOutSchema>;

export const adjustStockSchema = z
  .object({
    idempotencyKey: key,
    productId: id,
    locationId: optionalId,
    /** "change" = add/remove a quantity; "count" = enter the counted stock and we post the difference. */
    mode: z.enum(["change", "count"]).default("change"),
    type: z.enum(ADJUSTMENT_TYPES).optional(),
    quantity: z.preprocess((v) => (v === "" ? undefined : v), quantity().optional()),
    countedQuantity: z.preprocess((v) => (v === "" ? undefined : v), quantityOrZero("Counted quantity").optional()),
    reason: z.string({ error: "Enter a reason" }).trim().min(2, "Enter a reason").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "change") {
      if (!v.type) ctx.addIssue({ code: "custom", path: ["type"], message: "Choose what happened" });
      if (!v.quantity) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter a quantity greater than zero" });
    } else if (v.countedQuantity === undefined) {
      ctx.addIssue({ code: "custom", path: ["countedQuantity"], message: "Enter how many you counted" });
    }
  });
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const openingStockFields = {
  openingQuantity: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), quantityOrZero("Opening stock")),
  openingLocationId: optionalId,
};
