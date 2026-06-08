import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import { SERVICE_TITLE } from "@/lib/service-brand";
import type { TripPlannerInitialData } from "@/lib/types";

describe("TripPlannerApp", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("renders the initial trip name without waiting for client reload", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildInitialData(),
      }),
    );

    expect(markup).toContain("Tokyo Spring");
    expect(markup).not.toContain(SERVICE_TITLE);
  });

  it("renders planner header title and actions in separate rows", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildInitialData(),
      }),
    );

    expect(markup).toContain('class="app-header-title-row"');
    expect(markup).toContain('class="app-header-action-row"');
    expect(markup).toContain("Edit trip");
  });

  it("hides trip metadata editing from non-owners", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildInitialData({ role: "editor" }),
      }),
    );

    expect(markup).not.toContain("Edit trip");
  });

  it("renders current location as a map control instead of a planner header button", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const today = new Date().toISOString().slice(0, 10);

    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildInitialData({
          trip: {
            ...buildInitialData().trip,
            start_date: today,
            end_date: today,
            timezone: "UTC",
          },
        }),
      }),
    );

    expect(markup).toContain('class="map-current-location-button');
    expect(markup).toContain("map-current-location-available");
    expect(markup).not.toContain('class="current-location-button');
  });
});

function buildInitialData(
  overrides: Partial<TripPlannerInitialData> = {},
): TripPlannerInitialData {
  return {
    trip: {
      id: 1,
      created_by: "user-1",
      name: "Tokyo Spring",
      start_date: "2026-04-01",
      end_date: "2026-04-07",
      timezone: "Asia/Tokyo",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    role: "owner",
    plannerSnapshot: {
      places: [],
      itineraryItems: [],
      routeSegments: [],
    },
    ...overrides,
  };
}
