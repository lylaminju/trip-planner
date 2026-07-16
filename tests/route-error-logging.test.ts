import { afterEach, describe, expect, it, vi } from "vitest";

import { mapRouteError } from "@/app/api/_utils";
import {
  AiGenerationRateLimitError,
  AiPlannerConfigError,
  GoogleMapsUrlUpstreamError,
  GoogleMapsUrlValidationError,
  GoogleRoutesConfigError,
  GoogleRoutesRateLimitError,
  GoogleRoutesUpstreamError,
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
  TripAccessDeniedError,
  TripValidationError,
} from "@/server/errors";

const serverFaultErrors: [string, Error][] = [
  ["AiPlannerConfigError", new AiPlannerConfigError("planner misconfigured")],
  ["GoogleRoutesConfigError", new GoogleRoutesConfigError("routes key missing")],
  ["GoogleRoutesUpstreamError", new GoogleRoutesUpstreamError("routes down", 502)],
  ["GoogleMapsUrlUpstreamError", new GoogleMapsUrlUpstreamError("maps timed out", 504)],
];

const rateLimitErrors: [string, Error][] = [
  ["AiGenerationRateLimitError", new AiGenerationRateLimitError("daily cap hit")],
  ["GoogleRoutesRateLimitError", new GoogleRoutesRateLimitError("daily cap hit")],
];

const userFaultErrors: [string, Error][] = [
  ["PlaceNotFoundError", new PlaceNotFoundError(1)],
  ["RouteSegmentNotFoundError", new RouteSegmentNotFoundError(1)],
  ["ItineraryItemNotFoundError", new ItineraryItemNotFoundError(1)],
  ["TripAccessDeniedError", new TripAccessDeniedError(1)],
  ["TripValidationError", new TripValidationError("bad dates")],
  ["GoogleMapsUrlValidationError", new GoogleMapsUrlValidationError("bad url")],
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

describe("mapRouteError logging", () => {
  it.each(serverFaultErrors)("reports %s as a server fault", (_name, error) => {
    const spies = spyOnConsole();

    mapRouteError(error);

    expect(spies.error).toHaveBeenCalledWith(error);
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it.each(rateLimitErrors)("reports %s as a warning", (_name, error) => {
    const spies = spyOnConsole();

    mapRouteError(error);

    expect(spies.warn).toHaveBeenCalledWith(error);
    expect(spies.error).not.toHaveBeenCalled();
  });

  it.each(userFaultErrors)("stays silent for %s", (_name, error) => {
    const spies = spyOnConsole();

    mapRouteError(error);

    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });

  it("leaves unrecognized errors to the Next.js error boundary", () => {
    const spies = spyOnConsole();

    const response = mapRouteError(new Error("unexpected"));

    expect(response).toBeNull();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
  });
});
