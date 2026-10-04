"use client";

import { useFormAction } from "@/hooks/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { pending, onSubmit, fieldErrors: fe, formError } = useFormAction(loginAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field
        label="Email or mobile number"
        name="identifier"
        autoComplete="username"
        placeholder="98765 43210 or you@shop.in"
        required
        error={fe?.identifier}
      />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={fe?.password} />
      <SubmitButton pending={pending} className="w-full" pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
