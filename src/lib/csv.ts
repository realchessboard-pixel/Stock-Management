/**
 * CSV helpers. Cells that start with = + - @ (or tab/CR) are prefixed with
 * an apostrophe so spreadsheet apps don't execute them as formulas
 * (CSV injection) — except plain numbers like "-10", which stay numeric.
 */
const NUMERIC = /^-?\d+(\.\d+)?$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

/** UTF-8 BOM so Excel shows ₹ and Indian-language names correctly. */
export const CSV_BOM = "﻿";
