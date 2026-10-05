"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Power, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { addUserAction, changeRoleAction, memberStatusAction, resetPasswordAction } from "@/server/actions/admin";
import { InlineAction } from "./inline-action";

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastLoginAt: Date | null;
  role: RoleName;
  memberActive: boolean;
};

const ROLE_HELP: Record<RoleName, string> = {
  OWNER: "Everything, including users and settings",
  MANAGER: "Products, stock, suppliers, reports",
  STAFF: "Scan, receive, stock out, view products",
};

function AddUserForm() {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, fieldErrors: fe, formError } = useFormAction(addUserAction);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {state?.ok ? <Alert tone="success">User added. Share their login and password with them.</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" error={fe?.name} autoComplete="off" />
        <Field label="Email or mobile number" name="identifier" error={fe?.identifier} autoComplete="off" />
        <Field label="Password" name="password" type="text" hint="At least 8 characters. They can use this to log in." error={fe?.password} autoComplete="new-password" />
        <SelectField label="Role" name="role" defaultValue="STAFF" error={fe?.role}>
          {(Object.keys(ROLE_LABELS) as RoleName[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HELP[r]}</option>
          ))}
        </SelectField>
      </div>
      <SubmitButton pending={pending} size="md">
        <UserPlus className="size-4" aria-hidden /> Add user
      </SubmitButton>
    </form>
  );
}

function RoleSelect({ member }: { member: Member }) {
  const { pending, onSubmit, formError } = useFormAction(changeRoleAction);
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={member.id} />
      <label className="sr-only" htmlFor={`role-${member.id}`}>Role for {member.name}</label>
      <select id={`role-${member.id}`} name="role" defaultValue={member.role} disabled={pending}
        onChange={(e) => {
          if (confirm(`Change ${member.name}'s role to ${ROLE_LABELS[e.target.value as RoleName]}? They will need to log in again.`)) e.currentTarget.form?.requestSubmit();
          else e.currentTarget.value = member.role;
        }}
        className="h-11 rounded-lg border border-line bg-surface px-3 text-sm font-semibold">
        {(Object.keys(ROLE_LABELS) as RoleName[]).map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      {formError ? <span role="alert" className="text-sm text-danger-600">{formError}</span> : null}
    </form>
  );
}

function ResetPassword({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, fieldErrors, formError } = useFormAction(resetPasswordAction);
  if (state?.ok) return <p className="text-sm text-ok-700">Password changed. They were logged out everywhere.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-muted hover:bg-canvas">
        <KeyRound className="size-4" aria-hidden /> Reset password
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex w-full items-start gap-2" noValidate>
      <input type="hidden" name="userId" value={member.id} />
      <Field label="New password" name="password" type="text" className="flex-1" error={fieldErrors?.password} autoComplete="new-password" />
      <SubmitButton pending={pending} size="md" className="mt-7">Save</SubmitButton>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
    </form>
  );
}

export function UserManager({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Add a user</h2>
        <AddUserForm />
      </div>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-sm">
        {members.map((m) => {
          const self = m.id === currentUserId;
          return (
            <li key={m.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.name} {self ? <Badge tone="brand">You</Badge> : null} {!m.memberActive ? <Badge>Inactive</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-ink-muted">{m.email ?? m.phone}</p>
                  <p className="text-xs text-ink-muted">{m.lastLoginAt ? `Last login ${formatDateTime(m.lastLoginAt)}` : "Never logged in"}</p>
                </div>
                {self ? <Badge>{ROLE_LABELS[m.role]}</Badge> : <RoleSelect member={m} />}
              </div>
              {!self ? (
                <div className="flex flex-wrap gap-1">
                  <InlineAction action={memberStatusAction} fields={{ userId: m.id, active: String(!m.memberActive) }}
                    className={m.memberActive ? "text-danger-600 hover:bg-danger-50" : "text-ok-700 hover:bg-ok-50"}
                    confirmText={m.memberActive ? `Deactivate ${m.name}? They will be logged out and can't log in.` : undefined}>
                    <Power className="size-4" aria-hidden /> {m.memberActive ? "Deactivate" : "Reactivate"}
                  </InlineAction>
                  <ResetPassword member={m} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
