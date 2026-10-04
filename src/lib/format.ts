/** Formatting helpers for Indian shops (₹, lakh grouping, en-IN dates). Client-safe. */

type Num = number | string | { toString(): string } | null | undefined;

const toNumber = (v: Num) => (v === null || v === undefined ? 0 : Number(v.toString()));

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

export function formatMoney(v: Num, exact = false) {
  return (exact ? inrExact : inr).format(toNumber(v));
}

export function formatQty(v: Num) {
  return qtyFmt.format(toNumber(v));
}

export function formatSignedQty(v: Num, direction: "IN" | "OUT") {
  return `${direction === "IN" ? "+" : "−"}${formatQty(v)}`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/** Plain decimal string for form defaultValue (no grouping). */
export function decimalInput(v: Num): string {
  if (v === null || v === undefined) return "";
  return String(Number(v.toString()));
}
