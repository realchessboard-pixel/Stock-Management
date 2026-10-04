/** Label stock presets. Sizes in millimetres. Client-safe. */
export type LabelPreset = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  /** "roll" = one label per printed page (thermal printers); "sheet" = grid on A4. */
  kind: "roll" | "sheet";
  columns?: number;
  rows?: number;
  marginTopMm?: number;
  marginLeftMm?: number;
  gapXMm?: number;
  gapYMm?: number;
};

export const LABEL_PRESETS: LabelPreset[] = [
  { id: "roll-50x25", name: "Thermal roll 50 × 25 mm", widthMm: 50, heightMm: 25, kind: "roll" },
  { id: "roll-38x25", name: "Thermal roll 38 × 25 mm", widthMm: 38, heightMm: 25, kind: "roll" },
  { id: "roll-50x38", name: "Thermal roll 50 × 38 mm", widthMm: 50, heightMm: 38, kind: "roll" },
  { id: "a4-65", name: "A4 sheet · 65 labels (38 × 21 mm)", widthMm: 38.1, heightMm: 21.2, kind: "sheet", columns: 5, rows: 13, marginTopMm: 10.7, marginLeftMm: 4.7, gapXMm: 2.5, gapYMm: 0 },
  { id: "a4-24", name: "A4 sheet · 24 labels (70 × 37 mm)", widthMm: 70, heightMm: 37, kind: "sheet", columns: 3, rows: 8, marginTopMm: 0.5, marginLeftMm: 0, gapXMm: 0, gapYMm: 0 },
];

export const MAX_LABELS_PER_PRINT = 1000;

/** Parses "id:qty,id:qty" from the URL. */
export function parseLabelItems(raw: string | undefined): { id: string; qty: number }[] {
  if (!raw) return [];
  const out: { id: string; qty: number }[] = [];
  for (const part of raw.split(",").slice(0, 50)) {
    const [id, q] = part.split(":");
    if (!id || !/^[a-z0-9]{20,40}$/.test(id)) continue;
    const qty = Math.min(500, Math.max(1, Number.parseInt(q ?? "1", 10) || 1));
    out.push({ id, qty });
  }
  return out;
}
