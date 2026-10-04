import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { db, type Tx } from "@/server/db";

/**
 * Runs `fn` in a transaction at most once per (business, key).
 *
 * The key row is inserted INSIDE the same transaction as the mutation:
 * - first submission inserts the key, runs the mutation, stores the result;
 * - a double tap racing it blocks on the unique index until the first
 *   commits, then sees the key and gets the stored result back;
 * - if the first submission fails, its key insert rolls back too, so a
 *   retry runs normally.
 */
export async function runIdempotent<T extends Prisma.InputJsonValue | null>(
  businessId: string,
  key: string,
  operation: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<{ result: T; replayed: boolean }> {
  return db.$transaction(
    async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO "IdempotencyKey" ("businessId", "key", "operation", "createdAt")
        VALUES (${businessId}, ${key}, ${operation}, now())
        ON CONFLICT ("businessId", "key") DO NOTHING`;
      if (inserted === 0) {
        const existing = await tx.idempotencyKey.findUniqueOrThrow({ where: { businessId_key: { businessId, key } } });
        if (existing.operation !== operation) throw new AppError("CONFLICT", "This request was already used for something else. Please reload.");
        return { result: existing.result as T, replayed: true };
      }
      const result = await fn(tx);
      await tx.idempotencyKey.update({
        where: { businessId_key: { businessId, key } },
        data: { result: result === null ? undefined : result },
      });
      return { result, replayed: false };
    },
    { timeout: opts.timeoutMs ?? 15_000, maxWait: 10_000 },
  );
}
