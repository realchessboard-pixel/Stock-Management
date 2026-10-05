import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "sf-uploads-"));
const { sniffImage, storage } = await import("@/server/storage");

describe("upload safety", () => {
  it("detects real image types from bytes, not names", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("rejects path traversal and odd keys", async () => {
    const s = storage();
    await expect(s.put("../../etc/passwd", new Uint8Array([1]), "jpg")).rejects.toThrow();
    await expect(s.put("biz/../x.jpg", new Uint8Array([1]), "jpg")).rejects.toThrow();
    expect(await s.get("../secret")).toBeNull();
    const key = "abc123/0b6f0e2a-1c2d-4e5f-8a9b-0c1d2e3f4a5b.jpg";
    await s.put(key, new Uint8Array([0xff, 0xd8, 0xff]), "jpg");
    expect((await s.get(key))?.contentType).toBe("image/jpeg");
  });
});
