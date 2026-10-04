"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categorySchema, createProductSchema, supplierSchema, updateProductSchema } from "@/lib/validation/catalog";
import type { ActionResult } from "@/lib/result";
import { deleteCategory, saveCategory } from "@/server/catalog/categories";
import { saveSupplier } from "@/server/catalog/suppliers";
import { createProduct, setProductArchived, updateProduct } from "@/server/products/service";
import { tenantAction, toActionError } from "./safe-action";
import { assertCan } from "@/server/permissions";
import { requireContext } from "@/server/tenancy/context";

export const createProductAction = tenantAction(
  { schema: createProductSchema, permission: "product.write" },
  async (ctx, input) => {
    const { id } = await createProduct(ctx, input);
    revalidatePath("/products");
    return { id };
  },
);

export const updateProductAction = tenantAction(
  { schema: updateProductSchema, permission: "product.write" },
  async (ctx, input) => {
    const res = await updateProduct(ctx, input);
    revalidatePath("/products");
    revalidatePath(`/products/${input.id}`);
    return res;
  },
);

const idSchema = z.object({ id: z.string().cuid() });

export const archiveProductAction = tenantAction({ schema: idSchema, permission: "product.write" }, async (ctx, { id }) => {
  await setProductArchived(ctx, id, true);
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { id };
});

export const restoreProductAction = tenantAction({ schema: idSchema, permission: "product.write" }, async (ctx, { id }) => {
  await setProductArchived(ctx, id, false);
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { id };
});

export const saveCategoryAction = tenantAction({ schema: categorySchema, permission: "category.write" }, async (ctx, input) => {
  const res = await saveCategory(ctx, input);
  revalidatePath("/categories");
  return res;
});

export async function deleteCategoryAction(_prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext();
    assertCan(ctx, "category.write");
    const { id } = idSchema.parse({ id: fd.get("id") });
    await deleteCategory(ctx, id);
    revalidatePath("/categories");
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSupplierAction(prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const result = await tenantAction({ schema: supplierSchema, permission: "supplier.write" }, (ctx, input) => saveSupplier(ctx, input))(prev, fd);
  if (!result.ok) return result;
  revalidatePath("/suppliers");
  redirect(`/suppliers/${result.data.id}`);
}
