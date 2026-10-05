/** Movement type metadata. Client-safe. */
export const MOVEMENT_TYPES = [
  "OPENING",
  "PURCHASE",
  "SALE",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGE",
  "LOSS",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export type MovementTypeName = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_DIRECTION: Record<MovementTypeName, "IN" | "OUT"> = {
  OPENING: "IN",
  PURCHASE: "IN",
  CUSTOMER_RETURN: "IN",
  ADJUSTMENT_IN: "IN",
  TRANSFER_IN: "IN",
  SALE: "OUT",
  SUPPLIER_RETURN: "OUT",
  DAMAGE: "OUT",
  LOSS: "OUT",
  ADJUSTMENT_OUT: "OUT",
  TRANSFER_OUT: "OUT",
};

export const MOVEMENT_LABEL: Record<MovementTypeName, string> = {
  OPENING: "Opening stock",
  PURCHASE: "Received",
  SALE: "Stock out",
  CUSTOMER_RETURN: "Customer return",
  SUPPLIER_RETURN: "Returned to supplier",
  DAMAGE: "Damaged",
  LOSS: "Lost / missing",
  ADJUSTMENT_IN: "Adjustment (+)",
  ADJUSTMENT_OUT: "Adjustment (−)",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

/** Types a manager can pick on the Adjust Stock screen. */
export const ADJUSTMENT_TYPES = [
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "DAMAGE",
  "LOSS",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
] as const satisfies readonly MovementTypeName[];
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];
