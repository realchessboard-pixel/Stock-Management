import { z } from "zod";

/** Trims and turns "" into undefined, for optional text inputs. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Indian mobile numbers: accepts "98765 43210", "+91 98765-43210", "09876543210". */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.length === 12 && digits.startsWith("91")) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) local = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `+91${local}`;
}

export type LoginIdentifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

export function parseIdentifier(raw: string): LoginIdentifier | null {
  const v = raw.trim();
  if (v.includes("@")) {
    const r = z.string().email().safeParse(v.toLowerCase());
    return r.success ? { kind: "email", value: r.data } : null;
  }
  const phone = normalizePhone(v);
  return phone ? { kind: "phone", value: phone } : null;
}

export const identifierSchema = z
  .string({ error: "Enter your email or mobile number" })
  .trim()
  .min(1, "Enter your email or mobile number")
  .max(254)
  .transform((v, ctx) => {
    const id = parseIdentifier(v);
    if (!id) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email or 10-digit mobile number" });
      return z.NEVER;
    }
    return id;
  });

/** Client-generated UUID that makes a submission safe to retry. */
export const idempotencyKeySchema = z.string().uuid("Invalid request key, please reload the page");
