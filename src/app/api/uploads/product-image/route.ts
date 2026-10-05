import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { rateLimit } from "@/server/auth/rate-limit";
import { isSameOrigin } from "@/server/http";
import { logError } from "@/server/log";
import { can } from "@/server/permissions";
import { fileUrl, sniffImage, storage } from "@/server/storage";
import { getTenantContext } from "@/server/tenancy/context";

const MAX_BYTES = 3 * 1024 * 1024;

/** Uploads a product photo. Returns a tenant-scoped URL to store on the product. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!can(ctx, "product.write")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    await rateLimit(`upload:${ctx.businessId}`, 200, 60 * 60);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (max 3 MB)." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = sniffImage(bytes);
    if (!ext) return NextResponse.json({ error: "Only JPG, PNG or WebP photos are allowed." }, { status: 415 });
    const key = `${ctx.businessId}/${randomUUID()}.${ext}`;
    await storage().put(key, bytes, ext);
    return NextResponse.json({ url: fileUrl(key) });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.code === "RATE_LIMITED" ? 429 : 400 });
    logError("upload.product_image", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
