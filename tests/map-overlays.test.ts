import { afterEach, describe, expect, it, vi } from "vitest";

import { createMap, renderOverlays } from "@/components/map-panel/map-overlays";
import type { Place } from "@/lib/types";

describe("createMap", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("uses a neutral world view when the trip has no places", () => {
    const createdMaps: Array<Record<string, unknown>> = [];
    (globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: false }),
      google: {
        maps: {
          Map: class {
            constructor(
              public container: HTMLElement,
              public options: Record<string, unknown>,
            ) {
              createdMaps.push(options);
            }
          },
        },
      },
    };

    createMap({} as HTMLElement, [], []);

    expect(createdMaps[0]).toMatchObject({
      center: { lat: 20, lng: 0 },
      zoom: 2,
    });
  });
});

describe("renderOverlays", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { window?: unknown }).window;
  });

  it("uses a controlled zoom instead of fitBounds for the first single place", () => {
    const map = {
      fitBounds: vi.fn(),
      panTo: vi.fn(),
      setZoom: vi.fn(),
      panBy: vi.fn(),
    };
    const boundsSignatureRef = { current: "" };

    (globalThis as { document?: unknown }).document = fakeDocument();
    (globalThis as { window?: unknown }).window = {
      innerHeight: 800,
      matchMedia: () => ({ matches: false }),
      google: {
        maps: {
          InfoWindow: FakeInfoWindow,
          LatLngBounds: FakeLatLngBounds,
          marker: {
            AdvancedMarkerElement: FakeAdvancedMarkerElement,
          },
        },
      },
    };

    renderOverlays({
      map,
      items: [],
      unscheduledPlaces: [place({ latitude: 35.6812, longitude: 139.7671 })],
      mobileSheetState: "half",
      routeSegments: [],
      routeGeometries: new Map(),
      itemColors: new Map(),
      markerLabels: new Map(),
      markerRecords: new Map(),
      polylines: new Map(),
      boundsSignatureRef,
      infoWindowRef: { current: null },
      onSelectPlace: vi.fn(),
      onSelectSegment: vi.fn(),
    });

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.panTo).toHaveBeenCalledWith({ lat: 35.6812, lng: 139.7671 });
    expect(map.setZoom).toHaveBeenCalledWith(14);
    expect(boundsSignatureRef.current).toBe("initialized");
  });
});

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    trip_id: 1,
    name: "Tokyo Station",
    address: null,
    google_maps_url: "https://www.google.com/maps",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 35,
    longitude: 139,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    created_at: "2026-05-20 00:00:00",
    updated_at: "2026-05-20 00:00:00",
    ...overrides,
  };
}

function fakeDocument() {
  return {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  };
}

class FakeElement {
  className = "";
  textContent = "";
  style = { backgroundColor: "" };

  constructor(public tagName: string) {}

  append() {}

  setAttribute() {}
}

class FakeAdvancedMarkerElement {
  constructor(public options: Record<string, unknown>) {}

  addEventListener() {}
}

class FakeInfoWindow {
  setContent() {}
  open() {}
}

class FakeLatLngBounds {
  private positions: unknown[] = [];

  extend(position: unknown) {
    this.positions.push(position);
  }

  isEmpty() {
    return this.positions.length === 0;
  }
}
