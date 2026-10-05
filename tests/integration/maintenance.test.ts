import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { purgeExpiredData } from "@/server/maintenance";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";

describe("housekeeping", () => {
  beforeEach(resetDatabase);

  it("removes only expired sessions, stale rate limits and old idempotency keys", async () => {
    const ctx = await createTenant("Shop");
    const day = 24 * 60 * 60 * 1000;
    await db.session.createMany({
      data: [
        { tokenHash: "old", userId: ctx.userId, businessId: ctx.businessId, expiresAt: new Date(Date.now() - 1000) },
        { tokenHash: "live", userId: ctx.userId, businessId: ctx.businessId, expiresAt: new Date(Date.now() + day) },
      ],
    });
    await db.rateLimitBucket.createMany({
      data: [
        { key: "stale", count: 3, resetAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        { key: "active", count: 3, resetAt: new Date(Date.now() + 60 * 1000) },
      ],
    });
    await db.idempotencyKey.createMany({
      data: [
        { businessId: ctx.businessId, key: randomUUID(), operation: "x", createdAt: new Date(Date.now() - 31 * day) },
        { businessId: ctx.businessId, key: randomUUID(), operation: "x" },
      ],
    });
    expect(await purgeExpiredData()).toEqual({ sessions: 1, rateLimits: 1, idempotencyKeys: 1 });
    expect((await db.session.findMany()).map((s) => s.tokenHash)).toEqual(["live"]);
    expect((await db.rateLimitBucket.findMany()).map((b) => b.key)).toEqual(["active"]);
    expect(await db.idempotencyKey.count()).toBe(1);
  });
});
