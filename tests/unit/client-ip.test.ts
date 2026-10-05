import { describe, expect, it } from "vitest";
import { clientIp } from "@/server/auth/session";

describe("client IP for rate limiting", () => {
  it("prefers X-Real-IP set by the proxy", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.9");
  });
  it("ignores spoofed leading X-Forwarded-For values and uses the proxy-observed last hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" }))).toBe("198.51.100.7");
  });
  it("returns null without proxy headers", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});
