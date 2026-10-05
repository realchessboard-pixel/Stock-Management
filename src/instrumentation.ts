import type { Instrumentation } from "next";

/**
 * Every unhandled server error (pages, actions, route handlers) is logged
 * once as structured JSON with the request path. Point a log drain or error
 * tracker (Sentry, Better Stack, …) at stdout — no code changes needed.
 * Users never see these details; they get the friendly error screen.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "request.unhandled",
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      route: context.routePath,
      digest: e?.digest,
      error: { name: e?.name, message: e?.message, stack: e?.stack },
      at: new Date().toISOString(),
    }),
  );
};
