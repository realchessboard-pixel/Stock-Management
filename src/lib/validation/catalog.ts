import { z } from "zod";
import { optionalText, requiredText } from "./common";
import { openingStockFields } from "./stock";
import { moneyOrZero, optionalMoney, percent, quantityOrZero } from "./numbers";

export const UNITS = ["pcs", "set", "pair", "box", "pack", "dozen", "kg", "g", "m", "ft", "l", "roll", "sheet"] as const;

/** GST slabs currently used in India. */
export const GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

/** Code 128 can encode printable ASCII. Keep codes short and scanner-friendly. */
export const BARCODE_PATTERN = /^[A-Za-z0-9\-._/+*$%]{3,48}$/;
export const barcodeSchema = z
  .string()
  .trim()
  .refine((v) => BARCODE_PATTERN.test(v), "Barcode must be 3–48 letters/digits with no spaces");

export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_./]{0,39}$/;

const optionalId = z.preprocess((v) => (v === "" || v === "none" ? undefined : v), z.string().cuid().optional());
/** Checkbox with a hidden "false" fallback: the last submitted value wins. */
const checkbox = z.preprocess((v) => {
  const last = Array.isArray(v) ? v[v.length - 1] : v;
  return last === "on" || last === "true" || last === true;
}, z.boolean());

export const productFields = {
  name: requiredText("Product name", 160),
  sku: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .regex(SKU_PATTERN, "SKU can use letters, digits and - _ . / (max 40)")
      .transform((v) => v.toUpperCase())
      .optional(),
  ),
  description: optionalText(2000),
  unit: z.enum(UNITS, { error: "Choose a unit" }).default("pcs"),
  categoryId: optionalId,
  brandName: optionalText(80),
  preferredSupplierId: optionalId,
  purchasePrice: moneyOrZero("Purchase price"),
  sellingPrice: moneyOrZero("Selling price"),
  mrp: optionalMoney("MRP"),
  gstRate: percent("GST rate"),
  hsnSac: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().regex(/^\d{4,8}$/, "HSN/SAC is 4–8 digits").optional(),
  ),
  minStock: quantityOrZero("Minimum stock"),
  imageUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .max(500)
      .refine((v) => /^\/api\/files\/[a-z0-9]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(v) || (/^https:\/\//.test(v) && z.string().url().safeParse(v).success), "Upload a photo or enter a link starting with https://")
      .optional(),
  ),
};

const barcodeChoice = {
  /** "generate" = internal Code 128, "existing" = manufacturer/printed code, "none" = no barcode yet. */
  barcodeMode: z.enum(["generate", "existing", "none"]).default("generate"),
  barcode: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), barcodeSchema.optional()),
};

function refineProduct<T extends { mrp?: string; sellingPrice: string; barcodeMode?: string; barcode?: string }>(
  v: T,
  ctx: z.RefinementCtx,
) {
  if (v.mrp !== undefined && Number(v.sellingPrice) > Number(v.mrp)) {
    ctx.addIssue({ code: "custom", path: ["sellingPrice"], message: "Selling price can't be more than MRP" });
  }
  if (v.barcodeMode === "existing" && !v.barcode) {
    ctx.addIssue({ code: "custom", path: ["barcode"], message: "Scan or type the barcode" });
  }
}

export const createProductSchema = z
  .object({ ...productFields, ...barcodeChoice, ...openingStockFields, idempotencyKey: z.string().uuid() })
  .superRefine(refineProduct);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({ id: z.string().cuid(), ...productFields, ...barcodeChoice })
  .superRefine(refineProduct);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const PRODUCT_SORTS = ["name", "-createdAt", "sku", "-sellingPrice", "sellingPrice", "-updatedAt"] as const;
export const productListSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().cuid().optional().catch(undefined),
  brand: z.string().cuid().optional().catch(undefined),
  status: z.enum(["active", "archived", "all"]).default("active").catch("active"),
  sort: z.enum(PRODUCT_SORTS).default("name").catch("name"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type ProductListQuery = z.infer<typeof productListSchema>;

export const categorySchema = z.object({
  id: optionalId,
  name: requiredText("Category name", 80),
  description: optionalText(300),
});

export const supplierSchema = z.object({
  id: optionalId,
  name: requiredText("Supplier name", 120),
  company: optionalText(160),
  phone: optionalText(20).refine((v) => !v || /^[+\d][\d\s-]{6,18}$/.test(v), "Enter a valid phone number"),
  email: optionalText(254).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  address: optionalText(500),
  gstin: optionalText(15)
    .transform((v) => v?.toUpperCase())
    .refine((v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "GSTIN should look like 27ABCDE1234F1Z5"),
  notes: optionalText(1000),
  isActive: checkbox.optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;
