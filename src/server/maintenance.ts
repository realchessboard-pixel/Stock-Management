import "server-only";
import { db } from "@/server/db";
import { logError, logInfo } from "@/server/log";

/**
 * Self-cleaning housekeeping, so the app needs no cron job:
 * at most every 6 hours per server, one instance (guarded by a Postgres
 * advisory lock) deletes expired sessions, stale rate-limit counters and
 * idempotency keys older than 30 days. Runs in the background after a
 * request; never slows down or breaks the request itself.
 */
const EVERY_MS = 6 * 60 * 60 * 1000;
const LOCK_ID = 727_001; // arbitrary constant for pg_try_advisory_lock

const state = globalThis as unknown as { __sfMaintenanceAt?: number; __sfMaintenanceRunning?: boolean };

export async function purgeExpiredData(now = new Date()) {
  const [sessions, buckets, keys] = await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } } }),
    db.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } }),
  ]);
  return { sessions: sessions.count, rateLimits: buckets.count, idempotencyKeys: keys.count };
}

export function maybeRunMaintenance() {
  const now = Date.now();
  if (state.__sfMaintenanceRunning || (state.__sfMaintenanceAt && now - state.__sfMaintenanceAt < EVERY_MS)) return;
  state.__sfMaintenanceAt = now;
  state.__sfMaintenanceRunning = true;
  void (async () => {
    try {
      await db.$transaction(async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${LOCK_ID}) AS locked`;
        if (!locked) return;
        logInfo("maintenance.purged", await purgeExpiredData());
      });
    } catch (e) {
      logError("maintenance.failed", e);
    } finally {
      state.__sfMaintenanceRunning = false;
    }
  })();
}
