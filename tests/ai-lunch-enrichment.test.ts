import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchLunchRestaurantDetails = vi.fn();
const assertPlacesBudget = vi.fn();
const recordPlacesCall = vi.fn();

vi.mock("@/server/google-places", () => ({
  requirePlacesApiKey: () => "test-key",
  fetchLunchRestaurantDetails: (...args: unknown[]) =>
    fetchLunchRestaurantDetails(...args),
}));
vi.mock("@/server/google-places-search-service", () => ({
  assertPlacesBudget: (...args: unknown[]) => assertPlacesBudget(...args),
}));
vi.mock("@/server/supabase-google-places-usage-store", () => ({
  PLACES_SKU: { LUNCH_SEARCH: "lunch_search" },
  recordPlacesCall: (...args: unknown[]) => recordPlacesCall(...args),
}));

import {
  enrichLunchStops,
  lunchDisplayNotes,
  LUNCH_VERIFICATION_STATUS,
  unverifiedLunchStops,
} from "@/server/ai-lunch-enrichment";
import { GooglePlacesRateLimitError } from "@/server/errors";
import type { AiItineraryPlan } from "@/server/openai-ai-planner";

// 2026-05-27 is a Wednesday (getUTCDay() === 3).
const WEDNESDAY_DATE = "2026-05-27";
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function lunchStop(name = "Chez Janou") {
  return {
    name,
    latitude: 48.856,
    longitude: 2.365,
    start_time: "12:30",
    duration_minutes: 60,
    notes: "Provençal classics.",
  };
}

function planWithLunches(dates: string[]): AiItineraryPlan {
  return {
    days: dates.map((date) => ({
      date,
      visits: [],
      lunch: lunchStop(`Restaurant ${date}`),
    })),
  };
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
    open_weekdays: ALL_WEEKDAYS,
    ...overrides,
  };
}

beforeEach(() => {
  fetchLunchRestaurantDetails.mockReset();
  assertPlacesBudget.mockReset().mockResolvedValue(undefined);
  recordPlacesCall.mockReset().mockResolvedValue(undefined);
});

describe("enrichLunchStops", () => {
  it("adopts Google's record for a verified match and meters one call per lunch", async () => {
    fetchLunchRestaurantDetails.mockResolvedValue(googleDetails());

    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get(WEDNESDAY_DATE)).toMatchObject({
      name: "Chez Janou (Google)",
      latitude: 48.8561,
      longitude: 2.3649,
      google_place_id: "google-place-1",
      google_maps_url: "https://maps.google.com/?cid=1",
      rating: 4.6,
      user_rating_count: 1234,
      price_symbol: "$$",
      verification: LUNCH_VERIFICATION_STATUS.VERIFIED,
    });
    expect(fetchLunchRestaurantDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        query: `Restaurant ${WEDNESDAY_DATE}, Paris`,
        locationBias: { latitude: 48.856, longitude: 2.365 },
      }),
    );
    expect(assertPlacesBudget).toHaveBeenCalledWith("user-1", "lunch_search");
    expect(recordPlacesCall).toHaveBeenCalledWith("user-1", "lunch_search");
  });

  it("keeps the model's pick as unverified when Google finds nothing", async () => {
    fetchLunchRestaurantDetails.mockResolvedValue(null);

    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get(WEDNESDAY_DATE)).toMatchObject({
      name: `Restaurant ${WEDNESDAY_DATE}`,
      google_place_id: null,
      verification: LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    });
    expect(recordPlacesCall).toHaveBeenCalledTimes(1);
  });

  it("flags a restaurant closed on the visit weekday", async () => {
    fetchLunchRestaurantDetails.mockResolvedValue(
      // Open Sundays only; the visit is a Wednesday.
      googleDetails({ open_weekdays: [0] }),
    );

    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.CLOSED_WARNING,
    );
  });

  it("flags a permanently closed business", async () => {
    fetchLunchRestaurantDetails.mockResolvedValue(
      googleDetails({ business_status: "CLOSED_PERMANENTLY" }),
    );

    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.CLOSED_WARNING,
    );
  });

  it("stops spending after the shared budget is exhausted", async () => {
    assertPlacesBudget.mockRejectedValue(
      new GooglePlacesRateLimitError("budget gone"),
    );

    const enriched = await enrichLunchStops({
      plan: planWithLunches(["2026-05-27", "2026-05-28"]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get("2026-05-27")?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    expect(enriched.get("2026-05-28")?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    // The exhausted budget is remembered: only the first day even asks.
    expect(assertPlacesBudget).toHaveBeenCalledTimes(1);
    expect(fetchLunchRestaurantDetails).not.toHaveBeenCalled();
    expect(recordPlacesCall).not.toHaveBeenCalled();
  });

  it("degrades an upstream failure to unverified instead of throwing", async () => {
    fetchLunchRestaurantDetails.mockRejectedValue(new Error("upstream down"));

    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(enriched.get(WEDNESDAY_DATE)?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    expect(recordPlacesCall).not.toHaveBeenCalled();
  });
});

describe("unverifiedLunchStops", () => {
  it("maps every planned lunch without any Places spend", () => {
    const lunches = unverifiedLunchStops(
      planWithLunches(["2026-05-27", "2026-05-28"]),
    );

    expect(lunches.size).toBe(2);
    expect(lunches.get("2026-05-27")?.verification).toBe(
      LUNCH_VERIFICATION_STATUS.UNVERIFIED,
    );
    expect(assertPlacesBudget).not.toHaveBeenCalled();
    expect(fetchLunchRestaurantDetails).not.toHaveBeenCalled();
  });
});

describe("lunchDisplayNotes", () => {
  it("combines rating, price tier, and the model's note for verified picks", async () => {
    fetchLunchRestaurantDetails.mockResolvedValue(googleDetails());
    const enriched = await enrichLunchStops({
      plan: planWithLunches([WEDNESDAY_DATE]),
      destination: "Paris",
      userId: "user-1",
    });

    expect(lunchDisplayNotes(enriched.get(WEDNESDAY_DATE)!)).toBe(
      "★ 4.6 (1,234 reviews) · $$ — Provençal classics.",
    );
  });

  it("appends a check-before-going warning to unverified picks", () => {
    const lunches = unverifiedLunchStops(planWithLunches([WEDNESDAY_DATE]));

    expect(lunchDisplayNotes(lunches.get(WEDNESDAY_DATE)!)).toBe(
      "Provençal classics. — Couldn't verify this restaurant — check before going.",
    );
  });
});
