"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./button";
import { Spinner } from "./spinner";

/** Disables itself while the form is submitting, preventing double taps. */
export function SubmitButton({
  children,
  pendingText,
  pending: pendingProp,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      // Keep focus in the input while pressing: otherwise the on-screen keyboard
      // layout (hidden bottom nav) changes mid-tap and the button jumps away
      // from the finger, so the tap misses on Android.
      onMouseDown={(e) => e.preventDefault()}
      {...props}
    >
      {pending ? (
        <>
          <Spinner /> {pendingText ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
