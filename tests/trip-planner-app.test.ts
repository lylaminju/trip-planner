import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import type { PlannerSnapshot } from "@/lib/types";

describe("TripPlannerApp", () => {
  it("renders the initial trip name without waiting for client reload", () => {
    const initialSnapshot: PlannerSnapshot = {
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
      places: [],
      itineraryItems: [],
      routeSegments: [],
      role: "owner",
    };

    const markup = renderToStaticMarkup(
      createElement(TripPlannerApp, {
        tripId: 1,
        initialSnapshot,
      }),
    );

    expect(markup).toContain("Tokyo Spring");
    expect(markup).not.toContain("Trip Planner");
  });
});
