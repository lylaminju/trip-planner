import { afterEach, describe, expect, it, vi } from "vitest";

import { mapRouteError } from "@/app/api/_utils";
import {
  AiGenerationRateLimitError,
  AiPlannerConfigError,
  AiUpstreamRateLimitError,
  GoogleMapsUrlUpstreamError,
  GoogleMapsUrlValidationError,
  GooglePlacesConfigError,
  GooglePlacesRateLimitError,
  GooglePlacesUpstreamError,
  GoogleRoutesConfigError,
  GoogleRoutesRateLimitError,
  GoogleRoutesUpstreamError,
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
  TripAccessDeniedError,
  TripValidationError,
} from "@/server/errors";

// Where a mapped error is announced: `error` for our own faults, `warn` for
// exhausted budgets, `silent` for anything the caller caused.
type LogChannel = "error" | "warn" | "silent";

type ErrorCase = {
  name: string;
  error: Error;
  status: number;
  log: LogChannel;
};

// One row per mapped error class. Status and log channel are the whole contract
// of `mapRouteError`, and the same registration drives the alert severity, so a
// class missing from here is a class nobody notices breaking.
const ERROR_CASES: ErrorCase[] = [
  {
    name: "PlaceNotFoundError",
    error: new PlaceNotFoundError(1),
    status: 404,
    log: "silent",
  },
  {
    name: "RouteSegmentNotFoundError",
    error: new RouteSegmentNotFoundError(1),
    status: 404,
    log: "silent",
  },
  {
    name: "ItineraryItemNotFoundError",
    error: new ItineraryItemNotFoundError(1),
    status: 404,
    log: "silent",
  },
  {
    name: "TripAccessDeniedError",
    error: new TripAccessDeniedError(1),
    status: 403,
    log: "silent",
  },
  {
    name: "TripValidationError",
    error: new TripValidationError("bad dates"),
    status: 400,
    log: "silent",
  },
  {
    name: "GoogleMapsUrlValidationError",
    error: new GoogleMapsUrlValidationError("bad url"),
    status: 400,
    log: "silent",
  },
  {
    name: "AiGenerationRateLimitError",
    error: new AiGenerationRateLimitError("daily cap hit"),
    status: 429,
    log: "warn",
  },
  {
    name: "AiUpstreamRateLimitError",
    error: new AiUpstreamRateLimitError(),
    status: 429,
    log: "warn",
  },
  {
    name: "GoogleRoutesRateLimitError",
    error: new GoogleRoutesRateLimitError("daily cap hit"),
    status: 429,
    log: "warn",
  },
  {
    name: "GooglePlacesRateLimitError",
    error: new GooglePlacesRateLimitError("monthly cap hit"),
    status: 429,
    log: "warn",
  },
  {
    name: "AiPlannerConfigError",
    error: new AiPlannerConfigError("planner misconfigured"),
    status: 503,
    log: "error",
  },
  {
    name: "GoogleRoutesConfigError",
    error: new GoogleRoutesConfigError("routes key missing"),
    status: 503,
    log: "error",
  },
  {
    name: "GooglePlacesConfigError",
    error: new GooglePlacesConfigError("places key missing"),
    status: 503,
    log: "error",
  },
  // Upstream errors pass their own gateway status through rather than using a
  // fixed one, so both 502 and 504 are exercised.
  {
    name: "GoogleMapsUrlUpstreamError (504)",
    error: new GoogleMapsUrlUpstreamError("maps timed out", 504),
    status: 504,
    log: "error",
  },
  {
    name: "GoogleRoutesUpstreamError (502)",
    error: new GoogleRoutesUpstreamError("routes down", 502),
    status: 502,
    log: "error",
  },
  {
    name: "GooglePlacesUpstreamError (504)",
    error: new GooglePlacesUpstreamError("places timed out", 504),
    status: 504,
    log: "error",
  },
  {
    name: "GooglePlacesUpstreamError (502)",
    error: new GooglePlacesUpstreamError("places down", 502),
    status: 502,
    log: "error",
  },
];

function spyOnConsole() {
  return {
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mapRouteError status mapping", () => {
  it.each(ERROR_CASES)("maps $name to $status", async ({ error, status }) => {
    spyOnConsole();

    const response = mapRouteError(error);

    expect(response?.status).toBe(status);
    expect(await response?.json()).toEqual({ error: error.message });
  });

  it("leaves unrecognized errors to the Next.js error boundary", () => {
    const spies = spyOnConsole();

    const response = mapRouteError(new Error("unexpected"));

    expect(response).toBeNull();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });
});

describe("mapRouteError logging", () => {
  it.each(ERROR_CASES)(
    "announces $name on the $log channel",
    ({ error, log }) => {
      const spies = spyOnConsole();

      mapRouteError(error);

      expect(spies.error.mock.calls).toEqual(log === "error" ? [[error]] : []);
      expect(spies.warn.mock.calls).toEqual(log === "warn" ? [[error]] : []);
    },
  );
});
