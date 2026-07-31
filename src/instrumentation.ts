import type { Instrumentation } from "next";

// Fires for every server error Next did not see handled: route handlers that
// rethrew past `mapRouteError`, Server Component renders, and server actions.
// Errors we convert into a response never arrive here, so this hook and the
// route mapper together cover both halves without double-reporting.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
) => {
  // Loaded lazily so the alerting module and its `next/server` import stay out
  // of the edge instrumentation bundle when no error ever occurs.
  const { reportUnhandledServerError } = await import("@/server/error-alerts");

  reportUnhandledServerError(error, {
    path: request.path,
    method: request.method,
  });
};
