import { describe, expect, it } from "vitest";

import { parseLunchPlaceDetails } from "@/server/google-places";

const BASE_PLACE = {
  id: "place-1",
  displayName: { text: "Saint James" },
  location: { latitude: 43.261, longitude: -79.867 },
  businessStatus: "OPERATIONAL",
  googleMapsUri: "https://maps.google.com/?cid=1",
  rating: 4.6,
  userRatingCount: 900,
  priceLevel: "PRICE_LEVEL_MODERATE",
};

describe("parseLunchPlaceDetails", () => {
  it("parses a full place record including the weekly schedule", () => {
    const parsed = parseLunchPlaceDetails({
      ...BASE_PLACE,
      regularOpeningHours: {
        periods: [
          {
            open: { day: 1, hour: 8, minute: 30 },
            close: { day: 1, hour: 15, minute: 0 },
          },
        ],
      },
    });

    expect(parsed).toEqual({
      place_id: "place-1",
      name: "Saint James",
      latitude: 43.261,
      longitude: -79.867,
      google_maps_url: "https://maps.google.com/?cid=1",
      business_status: "OPERATIONAL",
      rating: 4.6,
      user_rating_count: 900,
      price_level: "PRICE_LEVEL_MODERATE",
      open_periods: [
        { open_day: 1, open_minute: 510, close_day: 1, close_minute: 900 },
      ],
    });
  });

  it("keeps a close-less period as always open", () => {
    const parsed = parseLunchPlaceDetails({
      ...BASE_PLACE,
      regularOpeningHours: { periods: [{ open: { day: 0, hour: 0 } }] },
    });

    expect(parsed?.open_periods).toEqual([
      { open_day: 0, open_minute: 0, close_day: null, close_minute: null },
    ]);
  });

  it.each([
    ["no schedule at all", {}],
    ["an empty periods array", { regularOpeningHours: { periods: [] } }],
    [
      "periods missing usable open days",
      { regularOpeningHours: { periods: [{ open: {} }] } },
    ],
  ])("returns null periods for %s", (_label, hoursOverride) => {
    expect(
      parseLunchPlaceDetails({ ...BASE_PLACE, ...hoursOverride })?.open_periods,
    ).toBeNull();
  });

  it.each([
    ["a missing id", { id: undefined }],
    ["a missing display name", { displayName: undefined }],
    ["missing coordinates", { location: {} }],
  ])("rejects a record with %s", (_label, overrides) => {
    expect(parseLunchPlaceDetails({ ...BASE_PLACE, ...overrides })).toBeNull();
  });
});
