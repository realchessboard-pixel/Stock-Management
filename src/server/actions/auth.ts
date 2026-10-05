"use server";

import { redirect } from "next/navigation";
import { loginSchema, signupSchema } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/result";
import { writeAudit } from "@/server/audit";
import { clearRateLimit, rateLimit } from "@/server/auth/rate-limit";
import { clientMeta, endSession, getSession, startSession } from "@/server/auth/session";
import { authenticate, registerBusiness } from "@/server/business/accounts";
import { db } from "@/server/db";
import { formDataToObject, parseInput, toActionError } from "./safe-action";

// Configurable for shops sharing one public IP (e.g. a market's Wi-Fi) and for test runs.
const SIGNUPS_PER_IP_PER_HOUR = Math.max(1, Number(process.env.SIGNUP_RATE_LIMIT_PER_HOUR) || 10);

export async function signupAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const meta = await clientMeta();
    await rateLimit(`signup:ip:${meta.ip ?? "unknown"}`, SIGNUPS_PER_IP_PER_HOUR, 60 * 60);
    const input = parseInput(signupSchema, formDataToObject(formData));
    const { userId, businessId } = await registerBusiness(input, meta);
    await startSession(userId, businessId);
  } catch (e) {
    return toActionError(e);
  }
  redirect("/onboarding");
}

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  let next = "/dashboard";
  try {
    const meta = await clientMeta();
    const input = parseInput(loginSchema, formDataToObject(formData));
    const idKey = `login:id:${input.identifier.value}`;
    // Per-account and per-IP limits slow down password guessing.
    await rateLimit(idKey, 8, 15 * 60);
    await rateLimit(`login:ip:${meta.ip ?? "unknown"}`, 30, 15 * 60);
    const { userId, businessId } = await authenticate(input);
    await clearRateLimit(idKey);
    await startSession(userId, businessId);
    await writeAudit(db, { businessId, userId, action: "user.login", entityType: "User", entityId: userId, ip: meta.ip });
    const requested = formData.get("next");
    // Only allow same-site relative paths (no open redirects).
    if (typeof requested === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(requested)) next = requested;
  } catch (e) {
    return toActionError(e);
  }
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const s = await getSession();
  if (s) {
    await writeAudit(db, {
      businessId: s.business.id,
      userId: s.user.id,
      action: "user.logout",
      entityType: "User",
      entityId: s.user.id,
    });
  }
  await endSession();
  redirect("/login");
}
