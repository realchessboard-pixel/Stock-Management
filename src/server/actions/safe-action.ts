import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { AppError, ERROR_CODES, isAppError } from "@/lib/errors";
import type { Permission } from "@/lib/permissions";
import type { ActionResult } from "@/lib/result";
import { assertCan } from "@/server/permissions";
import { isUniqueViolation } from "@/server/prisma-errors";
import { requireContext, type TenantContext } from "@/server/tenancy/context";
import { logError } from "@/server/log";

/** Converts FormData to a plain object; repeated keys become arrays. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue; // Next.js internals
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

export function toActionError(e: unknown): Extract<ActionResult<never>, { ok: false }> {
  unstable_rethrow(e); // let redirect()/notFound() through
  if (isAppError(e)) {
    return { ok: false, code: e.code, error: e.message, fieldErrors: e.fieldErrors, details: e.details };
  }
  if (isUniqueViolation(e)) return { ok: false, code: "DUPLICATE", error: ERROR_CODES.DUPLICATE };
  logError("action.unhandled", e);
  return { ok: false, code: "INTERNAL", error: ERROR_CODES.INTERNAL };
}

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    throw new AppError("VALIDATION", undefined, { fieldErrors });
  }
  return parsed.data;
}

/**
 * Standard pipeline for authenticated mutations:
 *   session → tenant context → permission → Zod → handler → typed result.
 * Use with useActionState: `(prevState, formData) => ActionResult`.
 */
export function tenantAction<S extends z.ZodType, T>(
  opts: { schema: S; permission?: Permission },
  handler: (ctx: TenantContext, input: z.infer<S>) => Promise<T>,
) {
  return async (_prev: unknown, formData: FormData): Promise<ActionResult<T>> => {
    try {
      const ctx = await requireContext();
      if (opts.permission) assertCan(ctx, opts.permission);
      const input = parseInput(opts.schema, formDataToObject(formData));
      return { ok: true, data: await handler(ctx, input) };
    } catch (e) {
      return toActionError(e);
    }
  };
}
