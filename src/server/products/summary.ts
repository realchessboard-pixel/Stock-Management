import "server-only";
import type { ProductDetail } from "./service";

/** Small, client-safe product shape used by scan / receive / stock-out screens. */
export type ProductSummary = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  barcode: string | null;
  imageUrl: string | null;
  sellingPrice: string;
  purchasePrice: string;
  minStock: string;
  onHand: number;
  status: "OUT" | "LOW" | "OK";
  archived: boolean;
  preferredSupplierId: string | null;
};

export function toSummary(p: ProductDetail): ProductSummary {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    barcode: p.barcode?.code ?? null,
    imageUrl: p.imageUrl,
    sellingPrice: p.sellingPrice.toString(),
    purchasePrice: p.purchasePrice.toString(),
    minStock: p.minStock.toString(),
    onHand: p.onHand,
    status: p.status,
    archived: p.archivedAt !== null,
    preferredSupplierId: p.preferredSupplierId,
  };
}
