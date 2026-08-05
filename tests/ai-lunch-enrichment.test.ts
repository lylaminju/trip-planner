import { beforeEach, describe, expect, it, vi } from "vitest";

const searchPlaceId = vi.fn();
const fetchLunchPlaceDetails = vi.fn();
const assertPlacesBudget = vi.fn();
const recordPlacesCall = vi.fn();

vi.mock("@/server/google-places", () => ({
  requirePlacesApiKey: () => "test-key",
  LUNCH_SEARCH_BIAS_RADIUS_METERS: 5_000,
  searchPlaceId: (...args: unknown[]) => searchPlaceId(...args),
  fetchLunchPlaceDetails: (...args: unknown[]) =>
    fetchLunchPlaceDetails(...args),
}));
vi.mock("@/server/google-places-search-service", () => ({
  assertPlacesBudget: (...args: unknown[]) => assertPlacesBudget(...args),
}));
vi.mock("@/server/supabase-google-places-usage-store", () => ({
  PLACES_SKU: { PLACE_DETAILS_ENTERPRISE: "place_details_enterprise" },
  recordPlacesCall: (...args: unknown[]) => recordPlacesCall(...args),
}));

import {
  enrichLunchStops,
  isOpenDuring,
  lunchDisplayNotes,
  LUNCH_CANDIDATE_RESULT,
  LUNCH_VERIFICATION_STATUS,
  unverifiedLunchStops,
  type EnrichedLunchStop,
} from "@/server/ai-lunch-enrichment";
import { GooglePlacesRateLimitError } from "@/server/errors";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

// 2026-05-27 is a Wednesday (getUTCDay() === 3).
const WEDNESDAY_DATE = "2026-05-27";

function candidate(name: string) {
  return {
    name,
    latitude: 48.856,
    longitude: 2.365,
    notes: `${name} is great.`,
  };
}

function planWithLunch(dates: string[]): AiItineraryPlan {
  return {
    days: dates.map((date) => ({
      date,
      visits: [],
      lunch: {
        start_time: "12:30",
        duration_minutes: 60,
        candidates: [candidate("Chez Janou"), candidate("Le Backup")],
      },
    })),
  };
}

// Open every day of the week between the given minutes-past-midnight bounds.
function allWeekPeriods(openMinute: number, closeMinute: number) {
  return Array.from({ length: 7 }, (_, day) => ({
    open_day: day,
    open_minute: openMinute,
    close_day: day,
    close_minute: closeMinute,
  }));
}

function googleDetails(overrides: Record<string, unknown> = {}) {
  return {
    place_id: "google-place-1",
    name: "Chez Janou (Google)",
    latitude: 48.8561,
    longitude: 2.3649,
    google_maps_url: "https://maps.google.com/?cid=1",
    business_status: "OPERATIONAL",
    rating: 4.6,
    user_rating_count: 1234,
    price_level: "PRICE_LEVEL_MODERATE",
    open_periods: allWeekPeriods(8 * 60, 22 * 60),
    ...overrides,
  };
}

function enrich(diningBudget: "budget" | "moderate" | "upscale" | null = null) {
  return enrichLunchStops({
    plan: planWithLunch([WEDNESDAY_DATE]),
    destination: "Paris",
    userId: "user-1",
    diningBudget,
  });
}

beforeEach(() => {
  searchPlaceId.mockReset().mockResolvedValue("google-place-1");
  fetchLunchPlaceDetails.mockReset().mockResolvedValue(googleDetails());
  assertPlacesBudget.mockReset().mockResolvedValue(undefined);
  recordPlacesCall.mockReset().mockResolvedValue(undefined);
});

describe("enrichLunchStops", () => {
  it("chooses the top candidate when it passes every gate, with one details call", async () => {
    const { lunchByDate, log } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)).toMatchObject({
      name: "Chez Janou (Google)",
      latitude: 48.8561,
      longitude: 2.3649,
      start_time: "12:30",
      duration_minutes: 60,
      notes: "Chez Janou is great.",
      google_place_id: "google-place-1",
      price_symbol: "$$",
      verification: LUNCH_VERIFICATION_STATUS.VERIFIED,
    });
    expect(searchPlaceId).toHaveBeenCalledTimes(1);
    expect(searchPlaceId).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Chez Janou, Paris",
        biasRadiusMeters: 5_000,
      }),
    );
    expect(assertPlacesBudget).toHaveBeenCalledWith(
      "user-1",
      "place_details_enterprise",
    );
    expect(recordPlacesCall).toHaveBeenCalledWith(
      "user-1",
      "place_details_enterprise",
    );
    expect(log).toEqual([
      {
        date: WEDNESDAY_DATE,
        outcome: LUNCH_VERIFICATION_STATUS.VERIFIED,
        chosen_index: 0,
        details_calls: 1,
        candidates: [
          { name: "Chez Janou", result: LUNCH_CANDIDATE_RESULT.CHOSEN },
          { name: "Le Backup", result: LUNCH_CANDIDATE_RESULT.NOT_FETCHED },
        ],
      },
    ]);
  });

  it("falls through to the second candidate when the first does not resolve", async () => {
    searchPlaceId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("google-place-2");
    fetchLunchPlaceDetails.mockResolvedValue(
      googleDetails({ place_id: "google-place-2", name: "Le Backup (Google)" }),
    );

    const { lunchByDate, log } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)?.name).toBe("Le Backup (Google)");
    expect(log[0].chosen_index).toBe(1);
    expect(log[0].candidates.map((entry) => entry.result)).toEqual([
      LUNCH_CANDIDATE_RESULT.NOT_FOUND,
      LUNCH_CANDIDATE_RESULT.CHOSEN,
    ]);
  });

  it("skips a candidate closed during the lunch window", async () => {
    fetchLunchPlaceDetails
      // Closes at 11:00, before the 12:30 lunch window.
      .mockResolvedValueOnce(
        googleDetails({ open_periods: allWeekPeriods(8 * 60, 11 * 60) }),
      )
      .mockResolvedValueOnce(
        googleDetails({ place_id: "google-place-2", name: "Le Backup (Google)" }),
      );

    const { lunchByDate, log } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)?.name).toBe("Le Backup (Google)");
    expect(log[0].details_calls).toBe(2);
    expect(log[0].candidates.map((entry) => entry.result)).toEqual([
      LUNCH_CANDIDATE_RESULT.CLOSED_AT_LUNCH,
      LUNCH_CANDIDATE_RESULT.CHOSEN,
    ]);
  });

  it("falls back to a closed warning when every candidate looks closed", async () => {
    fetchLunchPlaceDetails.mockResolvedValue(
      googleDetails({ open_periods: allWeekPeriods(8 * 60, 11 * 60) }),
    );

    const { lunchByDate, log } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.CLOSED_WARNING,
    );
    expect(log[0]).toMatchObject({
      outcome: LUNCH_VERIFICATION_STATUS.CLOSED_WARNING,
      chosen_index: 0,
      details_calls: 2,
    });
  });

  it("accepts a price level within one tier of the requested budget", async () => {
    // budget (tier 1) vs PRICE_LEVEL_MODERATE (tier 2): within one tier.
    const { lunchByDate } = await enrich("budget");

    expect(lunchByDate.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.VERIFIED,
    );
  });

  it("keeps a budget-mismatched venue as a verified fallback with its real price shown", async () => {
    fetchLunchPlaceDetails.mockResolvedValueOnce(
      googleDetails({ price_level: "PRICE_LEVEL_VERY_EXPENSIVE" }),
    );
    searchPlaceId
      .mockResolvedValueOnce("google-place-1")
      .mockResolvedValueOnce(null);

    const { lunchByDate, log } = await enrich("budget");

    expect(lunchByDate.get(WEDNESDAY_DATE)).toMatchObject({
      price_symbol: "$$$$",
      verification: LUNCH_VERIFICATION_STATUS.VERIFIED,
    });
    expect(log[0].candidates.map((entry) => entry.result)).toEqual([
      LUNCH_CANDIDATE_RESULT.BUDGET_MISMATCH,
      LUNCH_CANDIDATE_RESULT.NOT_FOUND,
    ]);
  });

  it("tries the next candidate after a details fetch error", async () => {
    fetchLunchPlaceDetails
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce(
        googleDetails({ place_id: "google-place-2", name: "Le Backup (Google)" }),
      );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lunchByDate, log } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)?.name).toBe("Le Backup (Google)");
    expect(log[0].candidates.map((entry) => entry.result)).toEqual([
      LUNCH_CANDIDATE_RESULT.DETAILS_ERROR,
      LUNCH_CANDIDATE_RESULT.CHOSEN,
    ]);
    warn.mockRestore();
  });

  it("stops spending once the shared budget is exhausted", async () => {
    assertPlacesBudget.mockRejectedValue(
      new GooglePlacesRateLimitError("budget gone"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lunchByDate, log } = await enrichLunchStops({
      plan: planWithLunch(["2026-05-27", "2026-05-28"]),
      destination: "Paris",
      userId: "user-1",
      diningBudget: null,
    });

    expect(lunchByDate.get("2026-05-27")?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    expect(lunchByDate.get("2026-05-28")?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    // The exhausted budget is remembered: only the first day even asks.
    expect(assertPlacesBudget).toHaveBeenCalledTimes(1);
    expect(fetchLunchPlaceDetails).not.toHaveBeenCalled();
    expect(log.map((entry) => entry.details_calls)).toEqual([0, 0]);
    warn.mockRestore();
  });

  it("keeps a successful verification when only the usage insert fails", async () => {
    recordPlacesCall.mockRejectedValue(new Error("insert failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lunchByDate } = await enrich();

    expect(lunchByDate.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.VERIFIED,
    );
    expect(warn).toHaveBeenCalledWith(
      "Failed to record Places place_details_enterprise usage",
      expect.any(Error),
    );
    warn.mockRestore();
  });
});

describe("isOpenDuring", () => {
  const OPEN_8_TO_15 = allWeekPeriods(8 * 60, 15 * 60);

  it.each([
    ["unknown hours pass", null, "12:30", 60, true],
    [
      "always-open place passes",
      [{ open_day: 0, open_minute: 0, close_day: null, close_minute: null }],
      "12:30",
      60,
      true,
    ],
    ["window inside a period passes", OPEN_8_TO_15, "12:30", 60, true],
    ["window overrunning the close fails", OPEN_8_TO_15, "14:30", 60, false],
    [
      "closed on the visit weekday fails",
      // Sunday-only hours; the visit is a Wednesday.
      [{ open_day: 0, open_minute: 480, close_day: 0, close_minute: 900 }],
      "12:30",
      60,
      false,
    ],
    [
      "cross-midnight period covers a midday window the next day",
      // Tuesday 18:00 through Wednesday 15:00.
      [{ open_day: 2, open_minute: 1080, close_day: 3, close_minute: 900 }],
      "12:30",
      60,
      true,
    ],
  ])("%s", (_label, periods, startTime, duration, expected) => {
    expect(isOpenDuring(periods, WEDNESDAY_DATE, startTime, duration)).toBe(
      expected,
    );
  });
});

describe("unverifiedLunchStops", () => {
  it("keeps the top candidate per day without any Places spend", () => {
    const lunches = unverifiedLunchStops(
      planWithLunch(["2026-05-27", "2026-05-28"]),
    );

    expect(lunches.size).toBe(2);
    expect(lunches.get("2026-05-27")).toMatchObject({
      name: "Chez Janou",
      start_time: "12:30",
      duration_minutes: 60,
      verification: LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    });
    expect(searchPlaceId).not.toHaveBeenCalled();
    expect(fetchLunchPlaceDetails).not.toHaveBeenCalled();
  });
});

describe("lunchDisplayNotes", () => {
  function enriched(overrides: Partial<EnrichedLunchStop>): EnrichedLunchStop {
    return {
      name: "Chez Janou",
      latitude: 48.856,
      longitude: 2.365,
      start_time: "12:30",
      duration_minutes: 60,
      notes: "Provençal classics.",
      google_place_id: "google-place-1",
      google_maps_url: "https://maps.google.com/?cid=1",
      rating: 4.6,
      user_rating_count: 1234,
      price_symbol: "$$",
      verification: LUNCH_VERIFICATION_STATUS.VERIFIED,
      ...overrides,
    };
  }

  it("combines rating, price tier, and the model's note for verified picks", () => {
    expect(lunchDisplayNotes(enriched({}))).toBe(
      "★ 4.6 (1,234 reviews) · $$ — Provençal classics.",
    );
  });

  it("appends a check-before-going warning to unverified picks", () => {
    expect(
      lunchDisplayNotes(
        enriched({
          rating: null,
          user_rating_count: null,
          price_symbol: null,
          verification: LUNCH_VERIFICATION_STATUS.UNVERIFIED,
        }),
      ),
    ).toBe(
      "Provençal classics. — Couldn't verify this restaurant — check before going.",
    );
  });
});
