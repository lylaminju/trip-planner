import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import { SERVICE_TITLE } from "@/lib/service-brand";
import { buildTripPlannerInitialData } from "./helpers/fixtures";

describe("TripPlannerApp", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("renders the initial trip name without waiting for client reload", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildTripPlannerInitialData(),
      }),
    );

    expect(markup).toContain("Tokyo Spring");
    expect(markup).not.toContain(SERVICE_TITLE);
  });

  it("renders planner header title and actions in separate rows", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildTripPlannerInitialData(),
      }),
    );

    expect(markup).toContain('class="app-header-title-row"');
    expect(markup).toContain('class="app-header-title-stack"');
    expect(markup).toContain('class="app-header-name-row"');
    expect(markup).toContain('class="app-header-dashboard-link"');
    expect(markup).toContain('class="icon-button app-header-edit-trip-button"');
    expect(markup).toContain('class="app-header-period"');
    expect(markup).toContain('class="section-primary-action"');
    expect(markup).not.toContain('class="app-header-action-row"');
    expect(markup).not.toContain('class="app-logout-footer"');
    expect(markup).not.toContain('class="app-logout-button"');
    expect(markup).toContain("Trips dashboard");
    expect(markup).toContain("Apr 1 - 7, 2026");
    expect(markup).toContain("Add Place");
    expect(markup).toContain("Edit trip details");
    expect(markup).not.toContain("Log out");
  });

  it("hides trip metadata editing from non-owners", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildTripPlannerInitialData({ role: "editor" }),
      }),
    );

    expect(markup).not.toContain("Edit trip details");
  });

  it("renders current location as a map control instead of a planner header button", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const today = new Date().toISOString().slice(0, 10);

    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialData: buildTripPlannerInitialData({
          trip: {
            ...buildTripPlannerInitialData().trip,
            start_date: today,
            end_date: today,
          },
        }),
      }),
    );

    expect(markup).toContain('class="map-current-location-button');
    expect(markup).toContain("map-current-location-available");
    expect(markup).not.toContain('class="current-location-button');
  });
});
