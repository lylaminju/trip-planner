import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapPanel } from "@/components/MapPanel";
import type { ItineraryView } from "@/lib/types";

describe("MapPanel empty state", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it("shows an empty map state when the trip has no places", () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    const itinerary: ItineraryView = { days: [], unscheduled: [] };

    const markup = renderToStaticMarkup(
      createElement(MapPanel, {
        itinerary,
        routeSegments: [],
        activePlaceId: null,
        activeCanonicalPlaceId: null,
        activeSegmentId: null,
        activeDate: null,
        mobileSheetState: "half",
        routeGeometries: new Map(),
        routeGeometryError: null,
        currentLocationPosition: null,
        currentLocationToast: null,
        canShowCurrentLocation: false,
        isCurrentLocationActive: false,
        canEdit: true,
        onToggleCurrentLocation: vi.fn(),
        onAddPlace: vi.fn(),
        onSelectPlace: vi.fn(),
        onSelectSegment: vi.fn(),
      }),
    );

    expect(markup).toContain("No places yet");
    expect(markup).toContain("Add place");
  });
});
