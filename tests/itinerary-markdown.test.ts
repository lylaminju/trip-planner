import { describe, expect, it } from "vitest";

import {
  buildExportFilename,
  generateScheduledItineraryMarkdown,
} from "@/lib/itinerary-markdown";
import type { ItineraryView, Place } from "@/lib/types";

describe("generateScheduledItineraryMarkdown", () => {
  it("exports only scheduled itinerary days with visit details", () => {
    const itinerary: ItineraryView = {
      days: [
        {
          date: "2026-06-01",
          color: "#2563eb",
          segments: [],
          items: [
            {
              id: 1,
              trip_id: 10,
              place_id: 1,
              visit_date: "2026-06-01",
              visit_time: "09:00",
              notes: "Arrive before opening rush.",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              place: place({
                id: 1,
                name: "Metropolitan Museum of Art",
                address: "1000 5th Ave, New York, NY",
                google_maps_url: "https://maps.google.com/?q=met",
                links: ["https://www.metmuseum.org", " https://tickets.metmuseum.org "],
              }),
            },
            {
              id: 2,
              trip_id: 10,
              place_id: 2,
              visit_date: "2026-06-01",
              visit_time: null,
              notes: null,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              place: place({
                id: 2,
                name: "Central Park",
                address: null,
                google_maps_url: "https://maps.google.com/?q=central",
              }),
            },
          ],
        },
      ],
      unscheduled: [
        place({
          id: 3,
          name: "Unscheduled Cafe",
          google_maps_url: "https://maps.google.com/?q=cafe",
        }),
      ],
    };

    expect(generateScheduledItineraryMarkdown("New York City", itinerary))
      .toBe(`# New York City Itinerary

## Mon, Jun 1

### 09:00 Metropolitan Museum of Art

- [Google Maps](https://maps.google.com/?q=met)
- Address: 1000 5th Ave, New York, NY
- Note:
  - Arrive before opening rush.
- https://www.metmuseum.org
- https://tickets.metmuseum.org

### Central Park

- [Google Maps](https://maps.google.com/?q=central)
`);
  });

  it("exports a clear empty state when nothing is scheduled", () => {
    expect(
      generateScheduledItineraryMarkdown("New York City", {
        days: [],
        unscheduled: [place({ id: 1, name: "Unscheduled" })],
      }),
    ).toBe(`# New York City Itinerary

No scheduled itinerary items yet.
`);
  });

  it("exports multi-line notes as nested note bullets", () => {
    expect(
      generateScheduledItineraryMarkdown("New York City", {
        days: [
          {
            date: "2026-06-01",
            color: "#2563eb",
            segments: [],
            items: [
              {
                id: 1,
                trip_id: 10,
                place_id: 1,
                visit_date: "2026-06-01",
                visit_time: null,
                notes: "First line\n\nSecond line",
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
                place: place({ id: 1, name: "Bryant Park" }),
              },
            ],
          },
        ],
        unscheduled: [],
      }),
    ).toContain(`- Note:
  - First line
  - Second line`);
  });
});

describe("buildExportFilename", () => {
  it("uses a readable sanitized markdown filename", () => {
    expect(buildExportFilename("New York City! June 2026")).toBe(
      "new-york-city-june-2026-itinerary.md",
    );
  });
});

function place(overrides: Partial<Place> & { id: number; name: string }): Place {
  const { id, name, ...rest } = overrides;

  return {
    id,
    trip_id: overrides.trip_id ?? 10,
    name,
    address: overrides.address ?? null,
    google_maps_url: overrides.google_maps_url ?? "https://maps.google.com",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40.7128,
    longitude: -74.006,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...rest,
  };
}
