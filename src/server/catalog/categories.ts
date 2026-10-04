import "server-only";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import type { TenantContext } from "@/server/tenancy/context";

export async function listCategories(ctx: TenantContext) {
  const rows = await db.category.findMany({
    where: { businessId: ctx.businessId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { archivedAt: null } } } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, description: c.description, productCount: c._count.products }));
}

export async function saveCategory(ctx: TenantContext, input: { id?: string; name: string; description?: string }) {
  try {
    return await db.$transaction(async (tx) => {
      if (input.id) {
        const updated = await tx.category.updateMany({
          where: { id: input.id, businessId: ctx.businessId },
          data: { name: input.name, description: input.description ?? null },
        });
        if (updated.count === 0) throw new AppError("NOT_FOUND", "Category not found.");
        await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "category.updated", entityType: "Category", entityId: input.id, metadata: { name: input.name } });
        return { id: input.id };
      }
      const created = await tx.category.create({
        data: { businessId: ctx.businessId, name: input.name, description: input.description },
      });
      await writeAudit(tx, { businessId: ctx.businessId, userId: ctx.userId, action: "category.created", entityType: "Category", entityId: created.id, metadata: { name: input.name } });
      return { id: created.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("DUPLICATE", "A category with this name already exists.", { fieldErrors: { name: ["Already exists"] } });
    }
    throw e;
  }
}

/** Deletes a category. Products in it (active or archived) are moved to "no category" first. */
export async function deleteCategory(ctx: TenantContext, id: string) {
  await db.$transaction(async (tx) => {
    const cat = await tx.category.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!cat) throw new AppError("NOT_FOUND", "Category not found.");
    const moved = await tx.product.updateMany({ where: { businessId: ctx.businessId, categoryId: id }, data: { categoryId: null } });
    await tx.category.delete({ where: { id: cat.id } });
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: "category.deleted",
      entityType: "Category",
      entityId: id,
      metadata: { name: cat.name, productsUncategorised: moved.count },
    });
  });
}
