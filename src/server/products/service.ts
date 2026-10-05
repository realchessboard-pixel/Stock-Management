import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { stockStatus } from "@/lib/stock-status";
import type { CreateProductInput, ProductListQuery, UpdateProductInput } from "@/lib/validation/catalog";
import { writeAudit } from "@/server/audit";
import { assertBarcodeFree, generateInternalBarcode, generateSku } from "@/server/barcodes";
import { assertWithinLimit } from "@/server/billing/entitlements";
import { resolveBrandId } from "@/server/catalog/brands";
import { db, type Tx } from "@/server/db";
import { runIdempotent } from "@/server/idempotency";
import { postOpeningStock } from "@/server/inventory/operations";
import { isUniqueViolation } from "@/server/prisma-errors";
import type { TenantContext } from "@/server/tenancy/context";

export const PRODUCT_PAGE_SIZE = 25;

/** Ensures referenced category/supplier/photo belong to this business (friendly error before the FK would fire). */
async function assertRefs(tx: Tx, ctx: TenantContext, refs: { categoryId?: string; preferredSupplierId?: string; imageUrl?: string }) {
  if (refs.imageUrl?.startsWith("/api/files/") && !refs.imageUrl.startsWith(`/api/files/${ctx.businessId}/`)) {
    throw new AppError("VALIDATION", undefined, { fieldErrors: { imageUrl: ["Upload the photo again"] } });
  }
  if (refs.categoryId) {
    const ok = await tx.category.findFirst({ where: { id: refs.categoryId, businessId: ctx.businessId }, select: { id: true } });
    if (!ok) throw new AppError("VALIDATION", undefined, { fieldErrors: { categoryId: ["Choose a valid category"] } });
  }
  if (refs.preferredSupplierId) {
    const ok = await tx.supplier.findFirst({ where: { id: refs.preferredSupplierId, businessId: ctx.businessId }, select: { id: true } });
    if (!ok) throw new AppError("VALIDATION", undefined, { fieldErrors: { preferredSupplierId: ["Choose a valid supplier"] } });
  }
}

async function assertSkuFree(tx: Tx, ctx: TenantContext, sku: string, exceptId?: string) {
  const existing = await tx.product.findUnique({
    where: { businessId_sku: { businessId: ctx.businessId, sku } },
    select: { id: true, name: true },
  });
  if (existing && existing.id !== exceptId) {
    throw new AppError("DUPLICATE_SKU", undefined, { fieldErrors: { sku: [`Already used by "${existing.name}"`] } });
  }
}

function productData(input: Omit<CreateProductInput, "idempotencyKey" | "barcodeMode" | "barcode" | "brandName" | "sku" | "openingQuantity" | "openingLocationId">) {
  return {
    name: input.name,
    description: input.description ?? null,
    unit: input.unit,
    categoryId: input.categoryId ?? null,
    preferredSupplierId: input.preferredSupplierId ?? null,
    purchasePrice: input.purchasePrice,
    sellingPrice: input.sellingPrice,
    mrp: input.mrp ?? null,
    gstRate: input.gstRate,
    hsnSac: input.hsnSac ?? null,
    minStock: input.minStock,
    imageUrl: input.imageUrl ?? null,
  };
}

function mapUniqueErrors(e: unknown): never {
  if (isUniqueViolation(e, "sku")) throw new AppError("DUPLICATE_SKU", undefined, { fieldErrors: { sku: ["Already used"] } });
  if (isUniqueViolation(e, "code")) throw new AppError("DUPLICATE_BARCODE", undefined, { fieldErrors: { barcode: ["Already used"] } });
  throw e;
}

/**
 * Creates a product (and its barcode). Idempotent on `idempotencyKey`, so a
 * double tap on "Save" creates one product, not two.
 *
 * Opening stock (if given) is posted as an OPENING movement in the same
 * transaction, so the product and its first stock appear together or not at all.
 * `afterCreate` lets callers (e.g. import) add more work to that transaction.
 */
export async function createProduct(
  ctx: TenantContext,
  input: CreateProductInput,
  afterCreate?: (tx: Tx, product: { id: string }) => Promise<void>,
): Promise<{ id: string; replayed: boolean }> {
  await assertWithinLimit(ctx, "products");
  try {
    const { result, replayed } = await runIdempotent(ctx.businessId, input.idempotencyKey, "product.create", async (tx) => {
      await assertRefs(tx, ctx, input);
      const sku = input.sku ?? (await generateSku(tx, ctx.businessId));
      await assertSkuFree(tx, ctx, sku);

      let barcode: { code: string; kind: "GENERATED" | "MANUFACTURER" } | null = null;
      if (input.barcodeMode === "generate") barcode = { code: await generateInternalBarcode(tx, ctx.businessId), kind: "GENERATED" };
      else if (input.barcodeMode === "existing" && input.barcode) {
        await assertBarcodeFree(tx, ctx.businessId, input.barcode);
        barcode = { code: input.barcode, kind: "MANUFACTURER" };
      }

      const brandId = await resolveBrandId(tx, ctx, input.brandName);
      const product = await tx.product.create({
        data: { ...productData(input), businessId: ctx.businessId, sku, brandId },
        select: { id: true, name: true },
      });
      if (barcode) await tx.barcode.create({ data: { businessId: ctx.businessId, productId: product.id, ...barcode } });

      await writeAudit(tx, {
        businessId: ctx.businessId,
        userId: ctx.userId,
        action: "product.created",
        entityType: "Product",
        entityId: product.id,
        metadata: { name: product.name, sku, barcode: barcode?.code ?? null },
      });
      if (input.openingQuantity && Number(input.openingQuantity) > 0) {
        await postOpeningStock(tx, ctx, product.id, input.openingQuantity, input.openingLocationId);
      }
      if (afterCreate) await afterCreate(tx, product);
      return { id: product.id };
    });
    return { id: result.id, replayed };
  } catch (e) {
    mapUniqueErrors(e);
  }
}

export async function updateProduct(ctx: TenantContext, input: UpdateProductInput) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findFirst({
        where: { id: input.id, businessId: ctx.businessId },
        include: { barcodes: true },
      });
      if (!current) throw new AppError("PRODUCT_NOT_FOUND");
      await assertRefs(tx, ctx, input);
      const sku = input.sku ?? current.sku;
      if (sku !== current.sku) await assertSkuFree(tx, ctx, sku, current.id);

      const brandId = await resolveBrandId(tx, ctx, input.brandName);
      const data = { ...productData(input), sku, brandId };
      await tx.product.update({ where: { id: current.id }, data });

      // Barcode changes
      const existing = current.barcodes[0] ?? null;
      let barcodeChange: { from: string | null; to: string | null } | null = null;
      if (input.barcodeMode === "existing" && input.barcode && input.barcode !== existing?.code) {
        await assertBarcodeFree(tx, ctx.businessId, input.barcode, current.id);
        if (existing) await tx.barcode.delete({ where: { id: existing.id } });
        await tx.barcode.create({ data: { businessId: ctx.businessId, productId: current.id, code: input.barcode, kind: "MANUFACTURER" } });
        barcodeChange = { from: existing?.code ?? null, to: input.barcode };
      } else if (input.barcodeMode === "generate" && (!existing || existing.kind !== "GENERATED")) {
        const code = await generateInternalBarcode(tx, ctx.businessId);
        if (existing) await tx.barcode.delete({ where: { id: existing.id } });
        await tx.barcode.create({ data: { businessId: ctx.businessId, productId: current.id, code, kind: "GENERATED" } });
        barcodeChange = { from: existing?.code ?? null, to: code };
      } else if (input.barcodeMode === "none" && existing) {
        await tx.barcode.delete({ where: { id: existing.id } });
        barcodeChange = { from: existing.code, to: null };
      }

      // Record only fields that changed, for a readable audit trail.
      const changed: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, v] of Object.entries(data)) {
        const before = (current as Record<string, unknown>)[k];
        const a = before === null || before === undefined ? null : String(before);
        const b = v === null || v === undefined ? null : String(v);
        if (a !== b && !(a !== null && b !== null && Number(a) === Number(b) && !isNaN(Number(a)))) changed[k] = { from: a, to: b };
      }
      if (barcodeChange) changed.barcode = { from: barcodeChange.from, to: barcodeChange.to };
      if (Object.keys(changed).length > 0) {
        await writeAudit(tx, {
          businessId: ctx.businessId,
          userId: ctx.userId,
          action: "product.updated",
          entityType: "Product",
          entityId: current.id,
          metadata: { changed } as Prisma.InputJsonValue,
        });
      }
      return { id: current.id };
    });
  } catch (e) {
    mapUniqueErrors(e);
  }
}

export async function setProductArchived(ctx: TenantContext, id: string, archived: boolean) {
  await db.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: { id, businessId: ctx.businessId },
      data: archived ? { archivedAt: new Date(), isActive: false } : { archivedAt: null, isActive: true },
    });
    if (updated.count === 0) throw new AppError("PRODUCT_NOT_FOUND");
    await writeAudit(tx, {
      businessId: ctx.businessId,
      userId: ctx.userId,
      action: archived ? "product.archived" : "product.restored",
      entityType: "Product",
      entityId: id,
    });
  });
}

export async function getProduct(ctx: TenantContext, id: string) {
  const p = await db.product.findFirst({
    where: { id, businessId: ctx.businessId },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      preferredSupplier: { select: { id: true, name: true } },
      barcodes: { select: { code: true, kind: true } },
      balances: { select: { quantity: true, location: { select: { id: true, name: true } } } },
    },
  });
  if (!p) return null;
  const onHand = p.balances.reduce((s, b) => s + Number(b.quantity), 0);
  return {
    ...p,
    barcode: p.barcodes[0] ?? null,
    onHand,
    status: stockStatus(onHand, Number(p.minStock)),
  };
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

const SORT_MAP: Record<ProductListQuery["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  name: [{ name: "asc" }, { id: "asc" }],
  sku: [{ sku: "asc" }],
  "-createdAt": [{ createdAt: "desc" }, { id: "desc" }],
  "-updatedAt": [{ updatedAt: "desc" }, { id: "desc" }],
  sellingPrice: [{ sellingPrice: "asc" }, { name: "asc" }],
  "-sellingPrice": [{ sellingPrice: "desc" }, { name: "asc" }],
};

export function productSearchWhere(businessId: string, q?: string): Prisma.ProductWhereInput {
  const term = q?.trim();
  if (!term) return { businessId };
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    businessId,
    OR: [
      { name: contains },
      { sku: contains },
      { barcodes: { some: { code: { contains: term } } } },
      { brand: { name: contains } },
      { category: { name: contains } },
    ],
  };
}

/** Paginated, searchable, filterable product list with on-hand totals. */
export async function listProducts(ctx: TenantContext, query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {
    ...productSearchWhere(ctx.businessId, query.q),
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.brand ? { brandId: query.brand } : {}),
    ...(query.status === "active" ? { archivedAt: null } : query.status === "archived" ? { archivedAt: { not: null } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: SORT_MAP[query.sort],
      skip: (query.page - 1) * PRODUCT_PAGE_SIZE,
      take: PRODUCT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        sellingPrice: true,
        minStock: true,
        imageUrl: true,
        archivedAt: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        barcodes: { select: { code: true } },
        balances: { select: { quantity: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  return {
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)),
    rows: rows.map((r) => {
      const onHand = r.balances.reduce((s, b) => s + Number(b.quantity), 0);
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        sellingPrice: r.sellingPrice.toString(),
        imageUrl: r.imageUrl,
        archived: r.archivedAt !== null,
        category: r.category?.name ?? null,
        brand: r.brand?.name ?? null,
        barcode: r.barcodes[0]?.code ?? null,
        onHand,
        status: stockStatus(onHand, Number(r.minStock)),
      };
    }),
  };
}
export type ProductListRow = Awaited<ReturnType<typeof listProducts>>["rows"][number];

/** Resolves a scanned/typed code: exact barcode first, then exact SKU. */
export async function findProductByCode(ctx: TenantContext, rawCode: string) {
  const code = rawCode.trim();
  if (!code || code.length > 64) return null;
  const byBarcode = await db.barcode.findUnique({
    where: { businessId_code: { businessId: ctx.businessId, code } },
    select: { productId: true },
  });
  const productId =
    byBarcode?.productId ??
    (await db.product.findFirst({
      where: { businessId: ctx.businessId, sku: { equals: code, mode: "insensitive" } },
      select: { id: true },
    }))?.id;
  return productId ? getProduct(ctx, productId) : null;
}
