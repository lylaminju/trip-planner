// Helpers for turning an upstream "please retry later" signal into a number of
// seconds and then into a short, user-facing phrase. Kept separate from OpenAI
// payload parsing and the error classes so both can share the same duration
// math without importing each other.

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const MILLISECONDS_PER_SECOND = 1000;

// Phrase used when we have no concrete retry-after signal to show the user.
export const DEFAULT_RETRY_AFTER_PHRASE = "a minute";

// Parse a retry delay from an HTTP `Retry-After` header (delta-seconds) or,
// failing that, from an upstream message such as "Please try again in 1h2m3.4s".
// Both inputs are untrusted, so this returns null when nothing parseable is
// present rather than throwing.
export function parseRetryAfterSeconds(
  headerValue: string | null,
  message: string,
): number | null {
  const fromHeader = retryAfterFromHeader(headerValue);
  if (fromHeader !== null) return fromHeader;
  return retryAfterFromMessage(message);
}

function retryAfterFromHeader(headerValue: string | null): number | null {
  if (!headerValue) return null;
  // `Retry-After` may also be an HTTP date; we only understand delta-seconds.
  const seconds = Number(headerValue.trim());
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.ceil(seconds);
}

// Only scan the "try again in ..." clause so unrelated numbers in the message
// (limits, token counts) can never be mistaken for a delay.
const RETRY_CLAUSE = /try again in\s+([0-9hms.\s]+)/i;
// "ms" is listed before "m" so millisecond tokens win the alternation.
const DURATION_TOKEN = /(\d+(?:\.\d+)?)\s*(ms|h|m|s)/gi;

function retryAfterFromMessage(message: string): number | null {
  const clause = RETRY_CLAUSE.exec(message);
  if (!clause) return null;

  let totalSeconds = 0;
  let matched = false;
  DURATION_TOKEN.lastIndex = 0;
  let token: RegExpExecArray | null;
  while ((token = DURATION_TOKEN.exec(clause[1])) !== null) {
    const value = Number(token[1]);
    if (!Number.isFinite(value)) continue;
    matched = true;
    switch (token[2].toLowerCase()) {
      case "ms":
        totalSeconds += value / MILLISECONDS_PER_SECOND;
        break;
      case "s":
        totalSeconds += value;
        break;
      case "m":
        totalSeconds += value * SECONDS_PER_MINUTE;
        break;
      case "h":
        totalSeconds += value * SECONDS_PER_HOUR;
        break;
    }
  }
  return matched ? Math.ceil(totalSeconds) : null;
}

// Short, user-facing phrase for a retry delay, for example "about 52 hours".
// Falls back to the generic phrase when no usable delay is known. Upstream
// retry hints top out around a couple of days, so hours stays the coarsest unit
// (a day-based ceiling would round a real 52h hint up to a misleading "3 days").
export function humanizeRetryAfter(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_RETRY_AFTER_PHRASE;
  }
  if (seconds < SECONDS_PER_MINUTE) return "less than a minute";
  if (seconds < SECONDS_PER_HOUR) {
    return approxPhrase(Math.ceil(seconds / SECONDS_PER_MINUTE), "minute");
  }
  return approxPhrase(Math.ceil(seconds / SECONDS_PER_HOUR), "hour");
}

function approxPhrase(count: number, unit: string): string {
  return `about ${count} ${unit}${count === 1 ? "" : "s"}`;
}
