import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { AppError } from "@/lib/errors";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type RawSheet = { headers: string[]; rows: Record<string, string>[] };

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return cellText(v.result as ExcelJS.CellValue); // formula
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v);
}

function looksLikeXlsx(buf: Buffer) {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" zip header
}

/** Parses CSV or XLSX (first sheet). Header row required. */
export async function parseSpreadsheet(file: File): Promise<RawSheet> {
  if (file.size === 0) throw new AppError("INVALID_IMPORT", "The file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError("INVALID_IMPORT", "File is too large. Maximum size is 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  let table: string[][];
  if (name.endsWith(".xlsx") || looksLikeXlsx(buf)) {
    if (!looksLikeXlsx(buf)) throw new AppError("INVALID_IMPORT", "This doesn't look like a valid Excel (.xlsx) file.");
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new AppError("INVALID_IMPORT", "Couldn't read this Excel file. Save it as .xlsx or CSV and try again.");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new AppError("INVALID_IMPORT", "The Excel file has no sheets.");
    table = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value).trim());
      table.push(cells);
    });
  } else if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.includes("csv") || file.type.startsWith("text/")) {
    const text = buf.toString("utf8").replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    if (parsed.errors.some((e) => e.type === "Quotes")) throw new AppError("INVALID_IMPORT", "The CSV file has broken quotes. Re-save it from Excel and try again.");
    table = parsed.data.map((r) => r.map((c) => (c ?? "").trim()));
  } else {
    throw new AppError("INVALID_IMPORT", "Upload a CSV or Excel (.xlsx) file.");
  }

  if (table.length < 2) throw new AppError("INVALID_IMPORT", "The file needs a header row and at least one product.");
  if (table.length - 1 > MAX_IMPORT_ROWS) throw new AppError("INVALID_IMPORT", `Too many rows. Import at most ${MAX_IMPORT_ROWS} products at a time.`);
  const headers = table[0].map((h) => h.trim());
  const rows = table.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
  return { headers, rows };
}
