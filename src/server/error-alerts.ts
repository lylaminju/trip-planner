import { after } from "next/server";

import {
  ALERT_SEVERITY,
  buildAlertEvent,
  classifyHandledError,
  createAlertThrottle,
  type AlertEvent,
} from "./alert-events";
import { buildDiscordAlertPayload, postDiscordAlert } from "./discord-alerts";

const alertThrottle = createAlertThrottle();

// Limits can go to their own channel so a day of budget chatter never buries a
// defect. When only the primary webhook is set, both severities share it.
function webhookUrlFor(event: AlertEvent): string | undefined {
  if (event.severity === ALERT_SEVERITY.LIMIT) {
    return (
      process.env.DISCORD_LIMIT_WEBHOOK_URL ??
      process.env.DISCORD_ALERT_WEBHOOK_URL
    );
  }

  return process.env.DISCORD_ALERT_WEBHOOK_URL;
}

function dispatch(event: AlertEvent): void {
  const webhookUrl = webhookUrlFor(event);
  if (!webhookUrl) {
    return;
  }

  const decision = alertThrottle.check(event, Date.now());
  if (!decision.send) {
    return;
  }

  const send = () =>
    postDiscordAlert(
      webhookUrl,
      buildDiscordAlertPayload(event, decision.suppressedCount, new Date()),
    );

  try {
    // Keeps webhook latency off the response path.
    after(send);
  } catch {
    // `after` needs a request scope. Instrumentation and scripts run outside
    // one, so fall back to an unawaited send there.
    void send();
  }
}

// Called from the route error mapper for failures we convert into a response.
// User errors (400/403/404) and unmapped errors are skipped — see
// `classifyHandledError`.
export function reportHandledRouteError(
  error: unknown,
  request?: { method: string; url: string },
): void {
  const severity = classifyHandledError(error);
  if (!severity) {
    return;
  }

  dispatch(
    buildAlertEvent({
      error,
      severity,
      route: request ? safePathname(request.url) : null,
      method: request?.method ?? null,
    }),
  );
}

// Called from instrumentation for errors that escaped every handler and became
// a 500. These are always defects, including a user-error class thrown outside
// a route's try block.
export function reportUnhandledServerError(
  error: unknown,
  request: { path: string; method: string },
): void {
  dispatch(
    buildAlertEvent({
      error,
      severity: ALERT_SEVERITY.BUG,
      route: request.path,
      method: request.method,
    }),
  );
}

// Only the pathname is reported. Query strings carry place text, coordinates,
// and session hints that do not belong in a chat channel.
function safePathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
