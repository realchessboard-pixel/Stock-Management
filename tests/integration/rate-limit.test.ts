import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimit, rateLimit } from "@/server/auth/rate-limit";
import { resetDatabase } from "../helpers/db";

describe("rate limiting", () => {
  beforeEach(resetDatabase);

  it("allows up to the limit then throws RATE_LIMITED", async () => {
    for (let i = 0; i < 3; i++) await rateLimit("t:key", 3, 60);
    await expect(rateLimit("t:key", 3, 60)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await clearRateLimit("t:key");
    await expect(rateLimit("t:key", 3, 60)).resolves.toBeUndefined();
  });
});
