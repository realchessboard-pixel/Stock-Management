import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-cookie";

const EXTEND_WHEN_LESS_THAN_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Session tokens are 256-bit random values. The cookie holds the raw token;
 * the database only stores HMAC(SESSION_SECRET, token), so a leaked DB dump
 * cannot be replayed as cookies.
 */
export function hashToken(token: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function clientMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Creates a session row and sets the cookie. Call only from Server Actions / Route Handlers. */
export async function startSession(userId: string, businessId: string) {
  const token = newToken();
  const meta = await clientMeta();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      businessId,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Invalidates every session of a user (e.g. after a role change or deactivation). */
export async function endAllSessionsForUser(userId: string, businessId?: string) {
  await db.session.deleteMany({ where: { userId, ...(businessId ? { businessId } : {}) } });
}

export type SessionInfo = {
  sessionId: string;
  user: { id: string; name: string; email: string | null; phone: string | null };
  business: { id: string; name: string; plan: "FREE" | "BASIC" | "PRO"; allowNegativeStock: boolean };
  role: "OWNER" | "MANAGER" | "STAFF";
};

/**
 * Resolves the current session (memoised per request). Returns null when the
 * cookie is missing/invalid/expired, the user is deactivated, or their
 * membership in the session's business was removed.
 */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      business: { select: { id: true, name: true, plan: true, allowNegativeStock: true } },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  const membership = await db.membership.findUnique({
    where: { businessId_userId: { businessId: session.businessId, userId: session.userId } },
    select: { role: true, isActive: true },
  });
  if (!membership?.isActive) return null;

  // Sliding expiry: extend at most about once a day per session.
  if (session.expiresAt.getTime() - now < EXTEND_WHEN_LESS_THAN_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000), lastSeenAt: new Date(now) },
    });
  }

  const { isActive: _ignored, ...user } = session.user;
  void _ignored;
  return { sessionId: session.id, user, business: session.business, role: membership.role };
});
