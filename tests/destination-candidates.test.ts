import { describe, expect, it } from "vitest";

import { matchDestinationCandidates } from "@/lib/destination-candidates";

import { candidateRecord } from "./ai-planning-service.test-helpers";

function savedPlace(
  overrides: Partial<{
    google_place_id: string | null;
    latitude: number;
    longitude: number;
  }> = {},
) {
  return { google_place_id: null, latitude: 0, longitude: 0, ...overrides };
}

describe("matchDestinationCandidates", () => {
  it("hides candidates already saved by Google place id or exact coordinates", () => {
    const byPlaceId = { ...candidateRecord(1), google_place_id: "gp-1" };
    const byCoordinates = { ...candidateRecord(2), latitude: 41.5 };
    const unsaved = { ...candidateRecord(3), latitude: 42.5 };

    const matches = matchDestinationCandidates(
      [byPlaceId, byCoordinates, unsaved],
      [
        savedPlace({ google_place_id: "gp-1" }),
        savedPlace({ latitude: 41.5, longitude: -74 }),
      ],
      "",
    );

    expect(matches).toEqual([unsaved]);
  });

  it("narrows short queries by candidate name or area, case-insensitively", () => {
    const bridge = { ...candidateRecord(1), name: "Brooklyn Bridge", area: null };
    const midtown = { ...candidateRecord(2), name: "MoMA", area: "Midtown" };
    const park = { ...candidateRecord(3), name: "Central Park", area: null };

    expect(
      matchDestinationCandidates([bridge, midtown, park], [], "br"),
    ).toEqual([bridge]);
    expect(
      matchDestinationCandidates([bridge, midtown, park], [], "mi"),
    ).toEqual([midtown]);
  });
});
