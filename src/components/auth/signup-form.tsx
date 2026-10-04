"use client";

import { useFormAction } from "@/hooks/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signupAction } from "@/server/actions/auth";

export function SignupForm() {
  const { pending, onSubmit, fieldErrors: fe, formError } = useFormAction(signupAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Field label="Shop name" name="businessName" placeholder="e.g. Sharma Hardware" autoComplete="organization" required error={fe?.businessName} />
      <Field label="Your name" name="ownerName" placeholder="e.g. Ravi Sharma" autoComplete="name" required error={fe?.ownerName} />
      <Field
        label="Email or mobile number"
        name="identifier"
        autoComplete="username"
        placeholder="98765 43210 or you@shop.in"
        hint="You'll use this to log in."
        required
        error={fe?.identifier}
      />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." required error={fe?.password} />
      <SubmitButton pending={pending} className="w-full" pendingText="Creating your shop…">
        Create my shop
      </SubmitButton>
    </form>
  );
}
