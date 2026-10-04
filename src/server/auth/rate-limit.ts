import "server-only";
import { AppError } from "@/lib/errors";
import { db } from "@/server/db";

/**
 * Fixed-window rate limiter backed by Postgres (one atomic upsert per hit),
 * so limits hold across multiple server instances. Swap for Redis later
 * without touching callers.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::double precision))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}::double precision) ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw new AppError("RATE_LIMITED");
}

export async function clearRateLimit(key: string): Promise<void> {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}
