import { describe, expect, it } from "vitest";

import {
  SPOTLIGHT_MAX_CARDS,
  selectSpotlightCandidates,
} from "@/components/ai-planning-wizard/generation-spotlight";
import type { AiDestinationCandidate } from "@/lib/types";

function makeCandidate(
  id: number,
  overrides: Partial<AiDestinationCandidate> = {},
): AiDestinationCandidate {
  return {
    id,
    destination_slug: "barcelona",
    name: `Spot ${id}`,
    category: "landmark",
    tags: [],
    area: null,
    region_distance_tier: "central",
    sort_order: id,
    latitude: 0,
    longitude: 0,
    google_place_id: null,
    typical_duration_minutes: 60,
    indoor_outdoor: null,
    planning_note: null,
    blurb: null,
    image_url: null,
    image_credit: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectSpotlightCandidates", () => {
  const catalog = [
    makeCandidate(1, { sort_order: 30 }),
    makeCandidate(2, { sort_order: 10 }),
    makeCandidate(3, { sort_order: 20 }),
  ];

  it("returns the traveler's picks in selection order when any are chosen", () => {
    const result = selectSpotlightCandidates(catalog, [3, 1]);
    expect(result.fromSelection).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual([3, 1]);
  });

  it("falls back to top spots by sort order when nothing is selected", () => {
    const result = selectSpotlightCandidates(catalog, []);
    expect(result.fromSelection).toBe(false);
    expect(result.items.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("ignores selected ids missing from the catalog", () => {
    const result = selectSpotlightCandidates(catalog, [999, 2]);
    expect(result.items.map((item) => item.id)).toEqual([2]);
  });

  it("treats a selection of only stale ids as no selection", () => {
    const result = selectSpotlightCandidates(catalog, [999]);
    expect(result.fromSelection).toBe(false);
    expect(result.items.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it("caps the carousel at the max card count", () => {
    const many = Array.from({ length: SPOTLIGHT_MAX_CARDS + 3 }, (_, index) =>
      makeCandidate(index + 1, { sort_order: index }),
    );
    expect(selectSpotlightCandidates(many, []).items).toHaveLength(
      SPOTLIGHT_MAX_CARDS,
    );
  });
});
