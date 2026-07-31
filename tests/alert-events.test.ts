import { describe, expect, it } from "vitest";

import {
  ALERT_SEVERITY,
  buildAlertEvent,
  classifyHandledError,
  createAlertThrottle,
  type AlertSeverity,
} from "@/server/alert-events";
import {
  AiGenerationRateLimitError,
  AiPlannerConfigError,
  AiUpstreamRateLimitError,
  GooglePlacesRateLimitError,
  GooglePlacesUpstreamError,
  GoogleRoutesConfigError,
  GoogleRoutesRateLimitError,
  GoogleRoutesUpstreamError,
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  TripAccessDeniedError,
  TripValidationError,
} from "@/server/errors";

const MINUTE_MS = 60 * 1000;

describe("classifyHandledError", () => {
  const cases: Array<{
    label: string;
    error: unknown;
    expected: AlertSeverity | null;
  }> = [
    {
      label: "AI planner misconfiguration",
      error: new AiPlannerConfigError("missing key"),
      expected: ALERT_SEVERITY.BUG,
    },
    {
      label: "Google Routes misconfiguration",
      error: new GoogleRoutesConfigError("missing key"),
      expected: ALERT_SEVERITY.BUG,
    },
    {
      label: "Google Routes upstream failure",
      error: new GoogleRoutesUpstreamError("bad gateway", 502),
      expected: ALERT_SEVERITY.BUG,
    },
    {
      label: "Google Places upstream failure",
      error: new GooglePlacesUpstreamError("timeout", 504),
      expected: ALERT_SEVERITY.BUG,
    },
    {
      label: "our own AI generation cap",
      error: new AiGenerationRateLimitError("daily cap"),
      expected: ALERT_SEVERITY.LIMIT,
    },
    {
      label: "upstream OpenAI 429",
      error: new AiUpstreamRateLimitError("tpm exhausted", 30),
      expected: ALERT_SEVERITY.LIMIT,
    },
    {
      label: "Google Routes cap",
      error: new GoogleRoutesRateLimitError("daily cap"),
      expected: ALERT_SEVERITY.LIMIT,
    },
    {
      label: "Google Places cap",
      error: new GooglePlacesRateLimitError("monthly cap"),
      expected: ALERT_SEVERITY.LIMIT,
    },
    {
      label: "forbidden trip access",
      error: new TripAccessDeniedError(1),
      expected: null,
    },
    {
      label: "invalid trip input",
      error: new TripValidationError("bad dates"),
      expected: null,
    },
    {
      label: "missing place",
      error: new PlaceNotFoundError(7),
      expected: null,
    },
    {
      label: "missing itinerary item",
      error: new ItineraryItemNotFoundError(9),
      expected: null,
    },
  ];

  it.each(cases)("classifies $label", ({ error, expected }) => {
    expect(classifyHandledError(error)).toBe(expected);
  });

  // Unmapped errors are rethrown by the route and reported by instrumentation.
  // Returning a severity here would announce every 500 twice.
  it("defers unmapped errors so instrumentation reports them once", () => {
    expect(
      classifyHandledError(new TypeError("undefined is not a function")),
    ).toBeNull();
  });
});

describe("buildAlertEvent", () => {
  it("keeps a stack on defects so the failing module is identifiable", () => {
    const event = buildAlertEvent({
      error: new GoogleRoutesConfigError("missing key"),
      severity: ALERT_SEVERITY.BUG,
      route: "/api/trips/1/planner",
      method: "POST",
    });

    expect(event.name).toBe("GoogleRoutesConfigError");
    expect(event.route).toBe("/api/trips/1/planner");
    expect(event.method).toBe("POST");
    expect(event.stack).toContain("GoogleRoutesConfigError");
  });

  it("omits the stack for limits, which the message already explains", () => {
    const event = buildAlertEvent({
      error: new AiGenerationRateLimitError("daily cap"),
      severity: ALERT_SEVERITY.LIMIT,
    });

    expect(event.stack).toBeNull();
  });

  it("surfaces upstream diagnostics separately from the user-facing message", () => {
    const event = buildAlertEvent({
      error: new AiUpstreamRateLimitError("limit tpm 30000", 20),
      severity: ALERT_SEVERITY.LIMIT,
    });

    expect(event.detail).toBe("limit tpm 30000");
    expect(event.message).not.toContain("limit tpm 30000");
  });

  it("labels non-Error throws so they still reach a channel", () => {
    const event = buildAlertEvent({
      error: "database exploded",
      severity: ALERT_SEVERITY.BUG,
    });

    expect(event.name).toBe("UnhandledError");
    expect(event.message).toBe("database exploded");
  });
});

describe("createAlertThrottle", () => {
  const bugEvent = (message: string, route = "/api/trips/1") =>
    buildAlertEvent({
      error: new GoogleRoutesConfigError(message),
      severity: ALERT_SEVERITY.BUG,
      route,
    });

  const limitEvent = (message: string) =>
    buildAlertEvent({
      error: new GoogleRoutesRateLimitError(message),
      severity: ALERT_SEVERITY.LIMIT,
    });

  it("sends the first occurrence immediately", () => {
    const throttle = createAlertThrottle();

    expect(throttle.check(bugEvent("missing key"), 0).send).toBe(true);
  });

  it("suppresses every repeat of a defect it has already reported", () => {
    const throttle = createAlertThrottle();
    throttle.check(bugEvent("missing key"), 0);

    expect(throttle.check(bugEvent("missing key"), MINUTE_MS)).toEqual({
      send: false,
      suppressedCount: 1,
    });
    expect(throttle.check(bugEvent("missing key"), 2 * MINUTE_MS)).toEqual({
      send: false,
      suppressedCount: 2,
    });
  });

  // Bugs alert once and never repeat, however long the defect keeps firing.
  it("never re-announces a defect, no matter how much time passes", () => {
    const throttle = createAlertThrottle();
    throttle.check(bugEvent("missing key"), 0);

    const aMonthLater = 30 * 24 * 60 * MINUTE_MS;
    expect(throttle.check(bugEvent("missing key"), aMonthLater).send).toBe(
      false,
    );
  });

  // "Never" is bounded by the instance holding the record. A replacement worker
  // — a cold start, or the next deploy — reports the defect again, so a
  // regression can never end up permanently muted.
  it("reports the same defect again on a fresh instance", () => {
    const first = createAlertThrottle();
    first.check(bugEvent("missing key"), 0);

    expect(createAlertThrottle().check(bugEvent("missing key"), 0).send).toBe(
      true,
    );
  });

  it("re-announces a still-exhausted budget with its tally", () => {
    const throttle = createAlertThrottle();
    throttle.check(limitEvent("daily cap"), 0);
    throttle.check(limitEvent("daily cap"), MINUTE_MS);
    throttle.check(limitEvent("daily cap"), 2 * MINUTE_MS);

    expect(throttle.check(limitEvent("daily cap"), 31 * MINUTE_MS)).toEqual({
      send: true,
      suppressedCount: 2,
    });
  });

  // A guest exhausting their own allowance and the global demo budget running
  // out share an error class, so only the message tells them apart.
  it("tracks budgets with different messages separately", () => {
    const throttle = createAlertThrottle();
    throttle.check(limitEvent("guest session limit reached"), 0);

    expect(
      throttle.check(limitEvent("global demo budget used up"), 0).send,
    ).toBe(true);
  });

  it("tracks the same failure on different routes separately", () => {
    const throttle = createAlertThrottle();
    throttle.check(bugEvent("missing key", "/api/trips/1"), 0);

    expect(
      throttle.check(bugEvent("missing key", "/api/trips/2"), 0).send,
    ).toBe(true);
  });

  // A budget still gone half an hour on is new information; a defect you have
  // already been told about is not.
  it("repeats limits but not defects", () => {
    const throttle = createAlertThrottle();
    throttle.check(bugEvent("missing key"), 0);
    throttle.check(limitEvent("daily cap"), 0);

    const anHourLater = 60 * MINUTE_MS;
    expect(throttle.check(limitEvent("daily cap"), anHourLater).send).toBe(
      true,
    );
    expect(throttle.check(bugEvent("missing key"), anHourLater).send).toBe(
      false,
    );
  });
});
