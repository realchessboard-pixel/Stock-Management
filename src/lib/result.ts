import type { ErrorCode, FieldErrors } from "./errors";

/** Shape every Server Action returns to the client. Never contains stack traces. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: FieldErrors; details?: Record<string, unknown> };

export const idleResult = null;
export type FormState<T = undefined> = ActionResult<T> | null;
