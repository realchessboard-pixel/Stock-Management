export type StockStatus = "OUT" | "LOW" | "OK";

/**
 * OUT: nothing left (or negative, when negative stock is enabled).
 * LOW: below the product's minimum level (only when a minimum is set).
 */
export function stockStatus(onHand: number, minStock: number): StockStatus {
  if (onHand <= 0) return "OUT";
  if (minStock > 0 && onHand < minStock) return "LOW";
  return "OK";
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  OUT: "Out of stock",
  LOW: "Low stock",
  OK: "In stock",
};
