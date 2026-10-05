import { beforeEach, describe, expect, it } from "vitest";
import { notifyStockChange, registerChannel, type LowStockEvent } from "@/server/notifications";
import type { TenantContext } from "@/server/tenancy/context";
import { resetDatabase } from "../helpers/db";
import { createTenant } from "../helpers/factories";
import { makeProduct, sell } from "../helpers/stock";

const events: LowStockEvent[] = [];
registerChannel({ name: "test", sendLowStock: async (e) => void events.push(e) });

describe("low-stock notifications", () => {
  let ctx: TenantContext;
  beforeEach(async () => {
    await resetDatabase();
    events.length = 0;
    ctx = await createTenant("Shop");
  });

  it("fires once when stock crosses below minimum, and again when it runs out", async () => {
    const id = await makeProduct(ctx, "12", { minStock: "10" });
    const step = async (q: string) => notifyStockChange(ctx, (await sell(ctx, id, q)).result);
    await step("1"); // 11: still OK
    expect(events).toHaveLength(0);
    await step("2"); // 9: OK → LOW
    expect(events.map((e) => e.level)).toEqual(["LOW"]);
    await step("1"); // 8: still LOW → no repeat
    expect(events).toHaveLength(1);
    await step("8"); // 0: LOW → OUT
    expect(events.map((e) => [e.level, e.current])).toEqual([
      ["LOW", 9],
      ["OUT", 0],
    ]);
  });
});
