import "server-only";

/**
 * Minimal structured logger. Errors are logged server-side with full detail
 * and never sent to the client. Replace with a log drain / Sentry later.
 */
export function logError(event: string, error: unknown, extra?: Record<string, unknown>) {
  const err = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { value: String(error) };
  console.error(JSON.stringify({ level: "error", event, ...extra, error: err, at: new Date().toISOString() }));
}

export function logInfo(event: string, extra?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  console.info(JSON.stringify({ level: "info", event, ...extra, at: new Date().toISOString() }));
}
