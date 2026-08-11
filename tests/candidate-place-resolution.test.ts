import { describe, expect, it } from "vitest";

import { candidatePlaceRejection } from "@/server/candidate-place-resolution";
import type { CandidatePlace } from "@/server/google-places";

const DESTINATION_NAME = "Hamilton";

// The generated point is the model's estimate, 252 m from where the market
// actually stands — the drift this resolution exists to replace.
const FARMERS_MARKET = {
  name: "Hamilton Farmers' Market",
  latitude: 43.2572,
  longitude: -79.8716,
};

function place(overrides: Partial<CandidatePlace> = {}): CandidatePlace {
  return {
    place_id: "ChIJF3fq64ObLIgRXeeGZ0IO7cY",
    name: "Hamilton Farmers' Market",
    latitude: 43.258991,
    longitude: -79.869697,
    photo_name: null,
    photo_attribution: null,
    ...overrides,
  };
}

describe("candidatePlaceRejection", () => {
  it("accepts the real place behind a drifted generated point", () => {
    expect(
      candidatePlaceRejection({
        candidate: FARMERS_MARKET,
        destinationName: DESTINATION_NAME,
        place: place(),
        placeIdsInUse: new Set(),
      }),
    ).toBeNull();
  });

  it("rejects a place another candidate in the catalog already holds", () => {
    expect(
      candidatePlaceRejection({
        candidate: FARMERS_MARKET,
        destinationName: DESTINATION_NAME,
        place: place(),
        placeIdsInUse: new Set(["ChIJF3fq64ObLIgRXeeGZ0IO7cY"]),
      }),
    ).toBe("duplicate");
  });

  it("rejects a same-type place that shares no distinctive word", () => {
    expect(
      candidatePlaceRejection({
        candidate: FARMERS_MARKET,
        destinationName: DESTINATION_NAME,
        place: place({
          place_id: "other-market",
          name: "St. Lawrence Market",
          latitude: 43.2585,
          longitude: -79.8698,
        }),
        placeIdsInUse: new Set(),
      }),
    ).toBe("name");
  });

  it("rejects a same-named place too far from the generated point", () => {
    expect(
      candidatePlaceRejection({
        candidate: FARMERS_MARKET,
        destinationName: DESTINATION_NAME,
        // Same name, wrong city: Kitchener is ~60 km west of Hamilton.
        place: place({ place_id: "far", latitude: 43.4516, longitude: -80.4925 }),
        placeIdsInUse: new Set(),
      }),
    ).toBe("distance");
  });
});
