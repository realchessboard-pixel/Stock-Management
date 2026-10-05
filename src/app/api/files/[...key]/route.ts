import { NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getTenantContext } from "@/server/tenancy/context";

/** Serves uploaded files to members of the owning business only. */
export async function GET(_req: Request, { params }: RouteContext<"/api/files/[...key]">) {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const { key: parts } = await params;
  const key = parts.join("/");
  if (parts[0] !== ctx.businessId) return new NextResponse(null, { status: 404 });
  const file = await storage().get(key);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
