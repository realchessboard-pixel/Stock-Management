"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";
import { rateLimit } from "@/server/auth/rate-limit";
import { parseSpreadsheet } from "@/server/imports/parse";
import { commitImport, validateImport, type ImportError } from "@/server/imports/products";
import { assertCan } from "@/server/permissions";
import { requireContext } from "@/server/tenancy/context";
import { toActionError } from "./safe-action";

export type ImportPreview = {
  fileName: string;
  total: number;
  validCount: number;
  errorCount: number;
  errors: ImportError[];
  unknownColumns: string[];
  sample: { row: number; name: string; sku: string | null; barcode: string | null; category: string | null; opening: string; price: string }[];
};

function readFile(fd: FormData): File {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new AppError("VALIDATION", "Choose a file to import.", { fieldErrors: { file: ["Choose a CSV or Excel file"] } });
  return file;
}

/** Step 1: parse + validate without writing anything. */
export async function previewImportAction(_prev: unknown, fd: FormData): Promise<ActionResult<ImportPreview>> {
  try {
    const ctx = await requireContext();
    assertCan(ctx, "product.import");
    await rateLimit(`import:${ctx.businessId}`, 60, 60 * 60);
    const file = readFile(fd);
    const sheet = await parseSpreadsheet(file);
    const v = await validateImport(ctx, sheet);
    const errorRows = new Set(v.errors.map((e) => e.row)).size;
    return {
      ok: true,
      data: {
        fileName: file.name,
        total: v.total,
        validCount: v.rows.length,
        errorCount: errorRows,
        errors: v.errors.slice(0, 200),
        unknownColumns: v.unknownColumns,
        sample: v.rows.slice(0, 8).map((r) => ({
          row: r.rowNumber,
          name: r.name,
          sku: r.sku ?? null,
          barcode: r.barcode ?? null,
          category: r.category ?? null,
          opening: r.openingQuantity,
          price: r.sellingPrice,
        })),
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

const commitSchema = z.object({ idempotencyKey: z.string().uuid(), generateBarcodes: z.enum(["true", "false"]).default("true") });

/** Step 2: re-parse and re-validate (never trust the preview), then write all-or-nothing. */
export async function commitImportAction(
  _prev: unknown,
  fd: FormData,
): Promise<ActionResult<{ created: number; withOpeningStock: number; barcodesGenerated: number }>> {
  try {
    const ctx = await requireContext();
    assertCan(ctx, "product.import");
    const { idempotencyKey, generateBarcodes } = commitSchema.parse({
      idempotencyKey: fd.get("idempotencyKey"),
      generateBarcodes: fd.get("generateBarcodes") ?? undefined,
    });
    const file = readFile(fd);
    const v = await validateImport(ctx, await parseSpreadsheet(file));
    if (v.errors.length) {
      throw new AppError("INVALID_IMPORT", `The file has ${new Set(v.errors.map((e) => e.row)).size} row(s) with errors. Nothing was imported.`, {
        details: { errors: v.errors.slice(0, 200) },
      });
    }
    const { result } = await commitImport(ctx, v.rows, { idempotencyKey, generateBarcodes: generateBarcodes === "true", fileName: file.name });
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { ok: true, data: result };
  } catch (e) {
    return toActionError(e);
  }
}
