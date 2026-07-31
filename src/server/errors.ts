import { humanizeRetryAfter } from "./retry-after";

// Gateway statuses we pass through when a third-party call fails (502) or times
// out (504).
export type UpstreamErrorStatus = 502 | 504;

export class PlaceNotFoundError extends Error {
  constructor(id: number) {
    super(`Place ${id} not found`);
    this.name = "PlaceNotFoundError";
  }
}

export class RouteSegmentNotFoundError extends Error {
  constructor(id: number) {
    super(`Route segment ${id} not found`);
    this.name = "RouteSegmentNotFoundError";
  }
}

export class ItineraryItemNotFoundError extends Error {
  constructor(id: number) {
    super(`Itinerary item ${id} not found`);
    this.name = "ItineraryItemNotFoundError";
  }
}

export class TripAccessDeniedError extends Error {
  constructor(readonly tripId: number) {
    super("Trip access denied.");
    this.name = "TripAccessDeniedError";
  }
}

export class TripValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripValidationError";
  }
}

export class GoogleMapsUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleMapsUrlValidationError";
  }
}

export class GoogleMapsUrlUpstreamError extends Error {
  readonly status: UpstreamErrorStatus;

  constructor(message: string, status: UpstreamErrorStatus) {
    super(message);
    this.name = "GoogleMapsUrlUpstreamError";
    this.status = status;
  }
}

export class GoogleRoutesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleRoutesConfigError";
  }
}

export class GoogleRoutesUpstreamError extends Error {
  readonly status: UpstreamErrorStatus;

  constructor(message: string, status: UpstreamErrorStatus) {
    super(message);
    this.name = "GoogleRoutesUpstreamError";
    this.status = status;
  }
}

export class AiPlannerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPlannerConfigError";
  }
}

export class AiGenerationRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGenerationRateLimitError";
  }
}

// OpenAI itself rejected the call with a 429 (tokens-per-minute budget),
// as opposed to our own daily generation cap above. The user-facing message
// echoes OpenAI's own retry-after hint when we can parse one, and falls back to
// a generic "in a minute" otherwise; upstreamDetail carries OpenAI's exact
// limit diagnostics for logs.
export class AiUpstreamRateLimitError extends Error {
  constructor(
    readonly upstreamDetail: string | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(
      `The AI service is handling too many requests right now. Please try again in ${humanizeRetryAfter(retryAfterSeconds)}.`,
    );
    this.name = "AiUpstreamRateLimitError";
  }
}

export class GoogleRoutesRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleRoutesRateLimitError";
  }
}

export class GooglePlacesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlacesConfigError";
  }
}

export class GooglePlacesUpstreamError extends Error {
  readonly status: UpstreamErrorStatus;

  constructor(message: string, status: UpstreamErrorStatus) {
    super(message);
    this.name = "GooglePlacesUpstreamError";
    this.status = status;
  }
}

export class GooglePlacesRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlacesRateLimitError";
  }
}

// Shared triage buckets. Route responses (`mapRouteError`) and operator alerts
// (`error-alerts`) must agree on which failures are our fault, which are budget
// exhaustion, and which are the caller's own doing, so the taxonomy lives here
// next to the classes rather than being restated per consumer. Registering a new
// error in the right list is all it takes to give it the matching status and
// alert severity.
const CONFIG_ERROR_TYPES = [
  AiPlannerConfigError,
  GoogleRoutesConfigError,
  GooglePlacesConfigError,
];

const UPSTREAM_ERROR_TYPES = [
  GoogleMapsUrlUpstreamError,
  GoogleRoutesUpstreamError,
  GooglePlacesUpstreamError,
];

const RATE_LIMIT_ERROR_TYPES = [
  AiGenerationRateLimitError,
  AiUpstreamRateLimitError,
  GoogleRoutesRateLimitError,
  GooglePlacesRateLimitError,
];

// Every class here extends Error directly, so the predicates narrow to Error
// and callers can read `message` without re-checking the concrete type.

// A required key or setting is missing: we serve 503 until it is fixed.
export function isConfigError(error: unknown): error is Error {
  return CONFIG_ERROR_TYPES.some((type) => error instanceof type);
}

// A third-party call failed or timed out. Each of these carries the gateway
// status to pass through, so the predicate narrows to it.
export function isUpstreamError(
  error: unknown,
): error is Error & { status: UpstreamErrorStatus } {
  return UPSTREAM_ERROR_TYPES.some((type) => error instanceof type);
}

// Misconfiguration or a failing upstream: something we have to fix or chase.
export function isServerFaultError(error: unknown): boolean {
  return isConfigError(error) || isUpstreamError(error);
}

// A budget ran out, ours or an upstream's. Not a defect, but worth watching.
export function isRateLimitError(error: unknown): error is Error {
  return RATE_LIMIT_ERROR_TYPES.some((type) => error instanceof type);
}
