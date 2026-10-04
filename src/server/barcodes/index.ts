import "server-only";
import bwipjs from "bwip-js/node";
import { AppError } from "@/lib/errors";
import type { DbOrTx, Tx } from "@/server/db";

export const INTERNAL_BARCODE_PREFIX = "SF";

/** Atomically bumps a per-business counter and returns the new value. */
export async function nextBusinessSeq(tx: Tx, businessId: string, column: "barcodeSeq" | "skuSeq" | "purchaseSeq" | "saleSeq") {
  const updated = await tx.business.update({
    where: { id: businessId },
    data: { [column]: { increment: 1 } },
    select: { barcodeSeq: true, skuSeq: true, purchaseSeq: true, saleSeq: true },
  });
  return updated[column];
}

export function formatInternalBarcode(seq: number) {
  return `${INTERNAL_BARCODE_PREFIX}${String(seq).padStart(8, "0")}`;
}

/** Generates the next unused internal Code 128 value for this business (e.g. SF00000042). */
export async function generateInternalBarcode(tx: Tx, businessId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = formatInternalBarcode(await nextBusinessSeq(tx, businessId, "barcodeSeq"));
    // A manually-entered code could already use this value; skip it if so.
    const taken = await tx.barcode.findUnique({ where: { businessId_code: { businessId, code } }, select: { id: true } });
    if (!taken) return code;
  }
  throw new AppError("INTERNAL");
}

/** Generates the next SKU like "SKU-00042" when the shopkeeper leaves SKU blank. */
export async function generateSku(tx: Tx, businessId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const sku = `SKU-${String(await nextBusinessSeq(tx, businessId, "skuSeq")).padStart(5, "0")}`;
    const taken = await tx.product.findUnique({ where: { businessId_sku: { businessId, sku } }, select: { id: true } });
    if (!taken) return sku;
  }
  throw new AppError("INTERNAL");
}

export async function assertBarcodeFree(client: DbOrTx, businessId: string, code: string, exceptProductId?: string) {
  const existing = await client.barcode.findUnique({
    where: { businessId_code: { businessId, code } },
    select: { productId: true, product: { select: { name: true } } },
  });
  if (existing && existing.productId !== exceptProductId) {
    throw new AppError("DUPLICATE_BARCODE", `Barcode already used by "${existing.product.name}".`, {
      fieldErrors: { barcode: [`Already used by "${existing.product.name}"`] },
    });
  }
}

type RenderOpts = { scale?: number; height?: number; includeText?: boolean };

/** Code 128 as an SVG string (crisp at any print size). */
export function renderBarcodeSvg(code: string, opts: RenderOpts = {}): string {
  return bwipjs.toSVG({
    bcid: "code128",
    text: code,
    height: opts.height ?? 12,
    includetext: opts.includeText ?? true,
    textxalign: "center",
    textsize: 9,
    paddingwidth: 4,
    paddingheight: 2,
  });
}

/** Code 128 as PNG bytes, for download. */
export async function renderBarcodePng(code: string, opts: RenderOpts = {}): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: code,
    scale: opts.scale ?? 4,
    height: opts.height ?? 12,
    includetext: opts.includeText ?? true,
    textxalign: "center",
    paddingwidth: 8,
    paddingheight: 4,
    backgroundcolor: "FFFFFF",
  });
}
