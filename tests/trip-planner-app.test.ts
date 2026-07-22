import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import { SERVICE_TITLE } from "@/lib/service-brand";
import { DEFAULT_VIEWER_TIMEZONE } from "@/lib/trip-classification";
import {
  buildPlace,
  buildTrip,
  buildTripPlannerInitialData,
} from "./helpers/fixtures";

describe("TripPlannerApp", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("renders the initial trip name without waiting for client reload", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
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
        currentUserId: "user-1",
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
    expect(markup).toContain('href="/trips"');
    expect(markup).toContain("Apr 1 - 7, 2026");
    expect(markup).toContain("Add Place");
    expect(markup).toContain("Edit trip details");
    expect(markup).not.toContain("Log out");
  });

  it("hides trip metadata editing from non-owners", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({ role: "viewer" }),
      }),
    );

    expect(markup).not.toContain("Edit trip details");
  });

  it("shows AI planning for owner-owned supported trips with valid dates", () => {
    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: buildTrip({
            destination: "New York City",
            destination_slug: "new-york-city",
          }),
        }),
      }),
    );

    expect(markup).toContain("Plan with AI");
  });

  it("shows AI planning in the empty map state for supported new trips", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";

    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: buildTrip({
            destination: "New York City",
            destination_slug: "new-york-city",
          }),
        }),
      }),
    );
    const emptyState = markupBetween(markup, "map-empty-state", "div");

    expect(emptyState).toContain(
      "Add your first place to start building the map.",
    );
    expect(emptyState).toContain("Plan with AI");
  });

  it("keeps AI planning available for non-empty supported trips", () => {
    const withPlaces = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: buildTrip({
            destination: "New York City",
            destination_slug: "new-york-city",
          }),
          plannerSnapshot: {
            places: [buildPlace({ name: "Central Park" })],
            itineraryItems: [],
            routeSegments: [],
          },
        }),
      }),
    );

    expect(withPlaces).toContain("Plan with AI");
  });

  it("hides AI planning for trips without a destination, non-owners, or invalid dates", () => {
    const unsupported = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: { ...buildTrip(), destination: "", destination_slug: null },
        }),
      }),
    );
    const editor = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          role: "viewer",
          trip: buildTrip({
            destination: "New York City",
            destination_slug: "new-york-city",
          }),
        }),
      }),
    );
    const missingDates = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: {
            ...buildTrip({
              destination: "New York City",
              destination_slug: "new-york-city",
              end_date: "2026-05-29",
            }),
            start_date: null,
          },
        }),
      }),
    );
    const reversedDates = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
        initialData: buildTripPlannerInitialData({
          trip: buildTrip({
            destination: "New York City",
            destination_slug: "new-york-city",
            start_date: "2026-05-30",
            end_date: "2026-05-29",
          }),
        }),
      }),
    );

    expect(unsupported).not.toContain("Plan with AI");
    expect(editor).not.toContain("Plan with AI");
    expect(missingDates).not.toContain("Plan with AI");
    expect(reversedDates).not.toContain("Plan with AI");
  });

  it("renders current location as a map control instead of a planner header button", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const today = localIsoDate(DEFAULT_VIEWER_TIMEZONE);

    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        currentUserId: "user-1",
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

function localIsoDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function markupBetween(markup: string, className: string, tag: string) {
  const start = markup.indexOf(className);
  expect(start).toBeGreaterThanOrEqual(0);
  const elementStart = markup.lastIndexOf(`<${tag}`, start);
  const elementEnd = markup.indexOf(`</${tag}>`, start);
  expect(elementStart).toBeGreaterThanOrEqual(0);
  expect(elementEnd).toBeGreaterThanOrEqual(0);

  return markup.slice(elementStart, elementEnd + tag.length + 3);
}
