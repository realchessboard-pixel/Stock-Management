import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseLabelItems } from "@/lib/labels";
import { stockStatus } from "@/lib/stock-status";
import { BARCODE_PATTERN } from "@/lib/validation/catalog";
import { money, quantity } from "@/lib/validation/numbers";

describe("decimal inputs", () => {
  const m = z.object({ v: money("Price") });
  const q = z.object({ v: quantity() });
  it.each([
    ["80", "80"],
    ["80.50", "80.5"],
    ["₹ 1,250.00", "1250"],
    ["007", "7"],
  ])("money %s → %s", (input, out) => expect(m.parse({ v: input }).v).toBe(out));
  it.each(["-1", "1.234", "abc", "1e5", ""])("money rejects %s", (input) => expect(m.safeParse({ v: input }).success).toBe(false));
  it("quantity allows 3 decimals and rejects zero", () => {
    expect(q.parse({ v: "2.125" }).v).toBe("2.125");
    expect(q.safeParse({ v: "0" }).success).toBe(false);
    expect(q.safeParse({ v: "1.2345" }).success).toBe(false);
  });
});

describe("stock status", () => {
  it("follows the spec: 0 → OUT, below minimum → LOW", () => {
    expect(stockStatus(0, 10)).toBe("OUT");
    expect(stockStatus(4, 10)).toBe("LOW");
    expect(stockStatus(10, 10)).toBe("OK");
    expect(stockStatus(4, 0)).toBe("OK");
  });
});

describe("barcode charset", () => {
  it("accepts EAN and internal codes, rejects markup and spaces", () => {
    expect(BARCODE_PATTERN.test("8901234567890")).toBe(true);
    expect(BARCODE_PATTERN.test("SF00000042")).toBe(true);
    expect(BARCODE_PATTERN.test("<svg>")).toBe(false);
    expect(BARCODE_PATTERN.test("AB 12")).toBe(false);
  });
});

describe("label item parsing", () => {
  it("clamps quantities and drops junk ids", () => {
    expect(parseLabelItems("cmabcdefghijklmnopqrstu:3,bad:2,cmabcdefghijklmnopqrstv:9999")).toEqual([
      { id: "cmabcdefghijklmnopqrstu", qty: 3 },
      { id: "cmabcdefghijklmnopqrstv", qty: 500 },
    ]);
  });
});
