import { describe, expect, it } from "vitest";
import { normalizePhone, parseIdentifier } from "@/lib/validation/common";
import { signupSchema } from "@/lib/validation/auth";

describe("phone normalisation", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("%s → %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(["12345", "1234567890", "+1 415 555 0100"])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
});

describe("login identifier", () => {
  it("lower-cases emails", () => {
    expect(parseIdentifier("  Ravi@Shop.IN ")).toEqual({ kind: "email", value: "ravi@shop.in" });
  });
  it("rejects junk", () => expect(parseIdentifier("not-an-id")).toBeNull());
});

describe("signup schema", () => {
  it("requires all fields and an 8+ char password", () => {
    const r = signupSchema.safeParse({ businessName: " ", ownerName: "", identifier: "x", password: "short" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["businessName", "ownerName", "identifier", "password"]));
  });
});
