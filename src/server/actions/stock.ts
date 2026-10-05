"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/result";
import { adjustStockSchema, receiveStockSchema, stockOutSchema } from "@/lib/validation/stock";
import { adjustStock, receiveStock, stockOut } from "@/server/inventory/operations";
import { assertCan } from "@/server/permissions";
import { findProductByCode, listProducts } from "@/server/products/service";
import { toSummary, type ProductSummary } from "@/server/products/summary";
import { requireContext } from "@/server/tenancy/context";
import { tenantAction, toActionError } from "./safe-action";

function revalidateStock(productId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/movements");
}

export const receiveStockAction = tenantAction({ schema: receiveStockSchema, permission: "stock.receive" }, async (ctx, input) => {
  const { result } = await receiveStock(ctx, input);
  revalidateStock(input.productId);
  return result;
});

export const stockOutAction = tenantAction({ schema: stockOutSchema, permission: "stock.out" }, async (ctx, input) => {
  const { result } = await stockOut(ctx, input);
  revalidateStock(input.productId);
  return result;
});

export const adjustStockAction = tenantAction({ schema: adjustStockSchema, permission: "stock.adjust" }, async (ctx, input) => {
  const { result } = await adjustStock(ctx, input);
  revalidateStock(input.productId);
  return result;
});

const codeSchema = z.string().trim().min(1).max(64);

/** Scanner lookup: exact barcode, then SKU. Returns null (not an error) when unknown. */
export async function lookupCodeAction(code: string): Promise<ActionResult<{ product: ProductSummary | null; code: string }>> {
  try {
    const ctx = await requireContext();
    assertCan(ctx, "stock.scan");
    const clean = codeSchema.parse(code);
    const product = await findProductByCode(ctx, clean);
    return { ok: true, data: { product: product ? toSummary(product) : null, code: clean } };
  } catch (e) {
    return toActionError(e);
  }
}

export type ProductHit = { id: string; name: string; sku: string; onHand: number; unit: string; status: "OUT" | "LOW" | "OK" };

/** Typeahead search for pickers (active products only, top 8). */
export async function searchProductsAction(q: string): Promise<ActionResult<ProductHit[]>> {
  try {
    const ctx = await requireContext();
    assertCan(ctx, "product.view");
    const term = z.string().trim().max(100).parse(q);
    if (!term) return { ok: true, data: [] };
    const { rows } = await listProducts(ctx, { q: term, status: "active", sort: "name", page: 1 });
    return { ok: true, data: rows.slice(0, 8).map(({ id, name, sku, onHand, unit, status }) => ({ id, name, sku, onHand, unit, status })) };
  } catch (e) {
    return toActionError(e);
  }
}
