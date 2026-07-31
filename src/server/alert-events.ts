import {
  AiUpstreamRateLimitError,
  isRateLimitError,
  isServerFaultError,
} from "./errors";

export const ALERT_SEVERITY = {
  // Something is broken and needs a code or config fix.
  BUG: "bug",
  // A budget ran out. Working as designed, but worth knowing about.
  LIMIT: "limit",
} as const;

export type AlertSeverity =
  (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];

// Errors with no mapped type reach the client as an unattributed 500, so they
// are labelled by their own class name when they have one.
const UNKNOWN_ERROR_NAME = "UnhandledError";

export type AlertEvent = {
  severity: AlertSeverity;
  name: string;
  message: string;
  // Upstream diagnostics the error chose to carry (OpenAI's own 429 detail
  // today), kept separate from the user-facing message.
  detail: string | null;
  stack: string | null;
  route: string | null;
  method: string | null;
};

// Errors that `mapRouteError` turns into a response never reach Next's
// `onRequestError` hook, so they are alerted from the route layer. Anything
// unmapped is rethrown and reported once by instrumentation instead — returning
// null here is what keeps those from being announced twice.
export function classifyHandledError(error: unknown): AlertSeverity | null {
  if (isServerFaultError(error)) {
    return ALERT_SEVERITY.BUG;
  }

  if (isRateLimitError(error)) {
    return ALERT_SEVERITY.LIMIT;
  }

  return null;
}

export function buildAlertEvent(input: {
  error: unknown;
  severity: AlertSeverity;
  route?: string | null;
  method?: string | null;
}): AlertEvent {
  const { error, severity } = input;
  const isError = error instanceof Error;

  return {
    severity,
    name: isError && error.name ? error.name : UNKNOWN_ERROR_NAME,
    message: isError ? error.message : String(error),
    detail:
      error instanceof AiUpstreamRateLimitError ? error.upstreamDetail : null,
    // A stack only helps for defects; limit alerts are answered by the message.
    stack:
      severity === ALERT_SEVERITY.BUG && isError ? (error.stack ?? null) : null,
    route: input.route ?? null,
    method: input.method ?? null,
  };
}

// Groups repeats of the same failure. The message is part of the key because a
// single error class covers several distinct budgets — a guest exhausting their
// own daily allowance and the whole demo's global cap are both a
// GoogleRoutesRateLimitError, and they need separate alerts.
export function alertFingerprint(event: AlertEvent): string {
  return [
    event.severity,
    event.name,
    event.route ?? "unknown-route",
    event.message,
  ].join("|");
}

const MINUTE_MS = 60 * 1000;

// How long a fingerprint stays quiet after it has been alerted; null means it
// never repeats. Being told twice about a defect you already know about adds
// nothing, so bugs alert once. A budget that is still exhausted half an hour
// later is new information, so limits keep repeating with their tally.
const ALERT_REPEAT_AFTER_MS: Record<AlertSeverity, number | null> = {
  [ALERT_SEVERITY.BUG]: null,
  [ALERT_SEVERITY.LIMIT]: 30 * MINUTE_MS,
};

// Serverless instances are short-lived, so this map stays small in practice.
// The ceiling only guards against a pathological spread of unique messages.
const ALERT_THROTTLE_MAX_ENTRIES = 500;

export type ThrottleDecision = {
  send: boolean;
  // Occurrences swallowed since the last alert for this fingerprint.
  suppressedCount: number;
};

type ThrottleEntry = { lastSentAt: number; suppressedCount: number };

export type AlertThrottle = {
  check(event: AlertEvent, now: number): ThrottleDecision;
};

// Instance-based so each serverless worker keeps its own record and tests can
// run without shared state. That bounds how long "never repeats" lasts: the map
// dies with its instance and every deploy starts clean, so a defect that
// resurfaces later is always announced again rather than staying muted forever.
// The same property makes it best-effort in the other direction — concurrent
// instances can each send the first alert for one failure.
export function createAlertThrottle(): AlertThrottle {
  const entries = new Map<string, ThrottleEntry>();

  function evictOldest(): void {
    while (entries.size >= ALERT_THROTTLE_MAX_ENTRIES) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      entries.delete(oldestKey);
    }
  }

  return {
    check(event, now) {
      const fingerprint = alertFingerprint(event);
      const entry = entries.get(fingerprint);

      const repeatAfterMs = ALERT_REPEAT_AFTER_MS[event.severity];

      if (
        entry &&
        (repeatAfterMs === null || now - entry.lastSentAt < repeatAfterMs)
      ) {
        entry.suppressedCount += 1;
        return { send: false, suppressedCount: entry.suppressedCount };
      }

      const suppressedCount = entry?.suppressedCount ?? 0;
      if (!entry) {
        evictOldest();
      }
      // Re-inserting keeps Map iteration order aligned with recency, so
      // eviction drops the least recently alerted fingerprint.
      entries.delete(fingerprint);
      entries.set(fingerprint, { lastSentAt: now, suppressedCount: 0 });

      return { send: true, suppressedCount };
    },
  };
}
