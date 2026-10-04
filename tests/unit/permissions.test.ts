import { describe, expect, it } from "vitest";
import { PERMISSIONS, roleCan } from "@/lib/permissions";

describe("role permissions", () => {
  it("owner can do everything", () => {
    for (const p of PERMISSIONS) expect(roleCan("OWNER", p)).toBe(true);
  });

  it("staff can scan, receive, stock out and view products only", () => {
    expect(roleCan("STAFF", "stock.scan")).toBe(true);
    expect(roleCan("STAFF", "stock.receive")).toBe(true);
    expect(roleCan("STAFF", "stock.out")).toBe(true);
    expect(roleCan("STAFF", "product.view")).toBe(true);
    for (const p of ["stock.adjust", "product.write", "product.import", "report.view", "user.manage", "audit.view"] as const) {
      expect(roleCan("STAFF", p)).toBe(false);
    }
  });

  it("manager manages inventory, products, suppliers and reports but not users/settings/audit", () => {
    for (const p of ["stock.adjust", "product.write", "supplier.write", "report.view", "product.import"] as const) {
      expect(roleCan("MANAGER", p)).toBe(true);
    }
    for (const p of ["user.manage", "business.settings", "audit.view"] as const) {
      expect(roleCan("MANAGER", p)).toBe(false);
    }
  });
});
