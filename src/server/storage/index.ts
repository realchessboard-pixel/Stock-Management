import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage abstraction. Local disk for development / single-server
 * deployments; swap in an S3-compatible driver (R2, S3, Spaces) for
 * serverless or multi-instance hosting without touching callers.
 * Keys always start with the businessId, which the file route checks.
 */
export interface StorageDriver {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

const SAFE_KEY = /^[a-z0-9]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

class LocalDiskDriver implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    if (!SAFE_KEY.test(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, bytes: Uint8Array) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  async get(key: string) {
    if (!SAFE_KEY.test(key)) return null;
    try {
      const bytes = await readFile(this.resolve(key));
      return { bytes, contentType: TYPES[key.split(".").pop()!] };
    } catch {
      return null;
    }
  }
}

let driver: StorageDriver | undefined;
export function storage(): StorageDriver {
  driver ??= new LocalDiskDriver(process.env.UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads"));
  return driver;
}

/** Detects the real image type from magic bytes (never trust the file name or browser MIME type). */
export function sniffImage(bytes: Uint8Array): "jpg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

export function fileUrl(key: string) {
  return `/api/files/${key}`;
}
