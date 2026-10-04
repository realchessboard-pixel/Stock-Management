import { z } from "zod";

/**
 * Money / quantity fields arrive from forms as strings. They are validated
 * and kept as normalised decimal STRINGS (never JS floats) and handed to
 * Prisma's Decimal, so ₹ amounts don't pick up floating-point errors.
 */
function decimalString(opts: { label: string; scale: number; max: number; allowZero?: boolean }) {
  const re = new RegExp(`^\\d+(\\.\\d{1,${opts.scale}})?$`);
  return z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().replace(/,/g, "").replace(/^₹\s*/, ""))
    .refine((v) => re.test(v), {
      message: opts.scale === 0 ? `${opts.label} must be a whole number` : `${opts.label} must be a number with up to ${opts.scale} decimals`,
    })
    .refine((v) => Number(v) <= opts.max, { message: `${opts.label} is too large` })
    .refine((v) => opts.allowZero !== false || Number(v) > 0, { message: `${opts.label} must be greater than zero` })
    .transform((v) => {
      const [i, f = ""] = v.split(".");
      const int = i.replace(/^0+(?=\d)/, "");
      const frac = f.replace(/0+$/, "");
      return frac ? `${int}.${frac}` : int;
    });
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const money = (label: string) => decimalString({ label, scale: 2, max: 99_999_999 });
export const optionalMoney = (label: string) => z.preprocess(blankToUndefined, money(label).optional());
export const moneyOrZero = (label: string) => z.preprocess((v) => blankToUndefined(v) ?? "0", money(label));

/** Stock quantities allow 3 decimals (metres, kg). */
export const quantity = (label = "Quantity") =>
  decimalString({ label, scale: 3, max: 9_999_999, allowZero: false }).describe("quantity");
export const quantityOrZero = (label = "Quantity") =>
  z.preprocess((v) => blankToUndefined(v) ?? "0", decimalString({ label, scale: 3, max: 9_999_999 }));

export const percent = (label: string) =>
  z.preprocess(
    (v) => blankToUndefined(v) ?? "0",
    decimalString({ label, scale: 2, max: 100 }),
  );
