"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionResult } from "@/lib/result";

/**
 * Wraps a Server Action for a form WITHOUT React's automatic form reset, so
 * a validation error doesn't wipe what the shopkeeper typed. Returns the
 * last result, a pending flag and an onSubmit handler.
 */
export function useFormAction<T>(action: (prev: unknown, fd: FormData) => Promise<ActionResult<T>>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const formError = state && !state.ok && state.code !== "VALIDATION" ? state.error : undefined;
  return { state, pending, onSubmit, fieldErrors, formError };
}
