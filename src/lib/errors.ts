/**
 * Typed application errors. Safe to show to users: `message` is written for a
 * shopkeeper, never contains internals. Anything that is not an AppError is
 * treated as an unexpected failure and replaced by a generic message.
 */
export const ERROR_CODES = {
  VALIDATION: "Please check the highlighted fields.",
  UNAUTHENTICATED: "Please log in to continue.",
  FORBIDDEN: "You don't have permission to do this. Ask the shop owner.",
  NOT_FOUND: "We couldn't find that.",
  PRODUCT_NOT_FOUND: "Product not found.",
  BARCODE_NOT_FOUND: "No product has this barcode.",
  DUPLICATE_SKU: "Another product already uses this SKU.",
  DUPLICATE_BARCODE: "Another product already uses this barcode.",
  DUPLICATE: "This already exists.",
  INSUFFICIENT_STOCK: "Not enough stock.",
  INVALID_QUANTITY: "Enter a quantity greater than zero.",
  INVALID_CREDENTIALS: "Wrong email/phone or password.",
  ACCOUNT_EXISTS: "An account with this email or phone already exists. Try logging in.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
  INVALID_IMPORT: "The file has errors. Nothing was imported.",
  PLAN_LIMIT: "Your current plan doesn't allow this. Upgrade to continue.",
  CONFLICT: "Someone else changed this at the same time. Please try again.",
  INTERNAL: "Something went wrong on our side. Please try again.",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type FieldErrors = Record<string, string[] | undefined>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    opts?: { fieldErrors?: FieldErrors; details?: Record<string, unknown> },
  ) {
    super(message ?? ERROR_CODES[code]);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = opts?.fieldErrors;
    this.details = opts?.details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
