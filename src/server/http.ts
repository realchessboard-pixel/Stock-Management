import "server-only";

/**
 * CSRF defence for Route Handlers that change state (Server Actions already
 * check this): the Origin header must match the host the request was sent to.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
