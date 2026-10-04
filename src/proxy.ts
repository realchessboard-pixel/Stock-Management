import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session-cookie";

/**
 * Optimistic auth gate only: bounces requests without a session cookie to
 * /login. Real authentication/authorisation happens on the server for every
 * page, action and route (see src/server/tenancy/context.ts).
 */
const PUBLIC_PATHS = ["/login", "/signup", "/offline"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && !isPublic && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Keep the cookie lifetime in step with the sliding server-side session.
  if (token && request.method === "GET") {
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return res;
}

export const config = {
  // Skip static assets, images, PWA files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt).*)"],
};
