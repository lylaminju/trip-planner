import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMap,
  renderOverlays,
  updateOverlaySelection,
  type MarkerRecord,
  type PolylineRecord,
} from "@/components/map-panel/map-overlays";
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
      map: map as unknown as google.maps.Map,
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

describe("updateOverlaySelection", () => {
  it("lifts and enlarges the markers at both ends of the selected segment", () => {
    const from = markerRecord();
    const to = markerRecord();
    const other = markerRecord();
    const markerRecords = new Map<string, MarkerRecord>([
      ["item:1", from.record],
      ["item:2", to.record],
      ["item:3", other.record],
    ]);
    const polylines = new Map<number, PolylineRecord>([
      [10, polylineRecord({ fromItemId: 1, toItemId: 2 })],
    ]);

    updateOverlaySelection(markerRecords, polylines, null, null, 10, null);

    expect(from.classes).toContain("segment-active");
    expect(to.classes).toContain("segment-active");
    expect(other.classes).not.toContain("segment-active");
    expect(from.zIndex()).toBeGreaterThan(other.zIndex());
    expect(to.zIndex()).toBe(from.zIndex());
  });

  it("drops the segment highlight once no segment is selected", () => {
    const from = markerRecord();
    const markerRecords = new Map<string, MarkerRecord>([
      ["item:1", from.record],
    ]);
    const polylines = new Map<number, PolylineRecord>([
      [10, polylineRecord({ fromItemId: 1, toItemId: 2 })],
    ]);

    updateOverlaySelection(markerRecords, polylines, null, null, 10, null);
    updateOverlaySelection(markerRecords, polylines, null, null, null, null);

    expect(from.classes).not.toContain("segment-active");
  });
});

function markerRecord() {
  const classes = new Set<string>();
  const marker = { zIndex: 0 };
  const element = {
    classList: {
      toggle(name: string, force: boolean) {
        if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
    },
  };

  return {
    classes,
    zIndex: () => marker.zIndex,
    record: {
      marker: marker as unknown as google.maps.marker.AdvancedMarkerElement,
      element: element as unknown as HTMLElement,
      signature: "signature",
      date: null,
    } satisfies MarkerRecord,
  };
}

function polylineRecord(endpoints: {
  fromItemId: number;
  toItemId: number;
}): PolylineRecord {
  return {
    polyline: { setOptions() {} } as unknown as google.maps.Polyline,
    signature: "signature",
    date: null,
    ...endpoints,
  };
}

function place(overrides: Partial<Place>): Place {
  return {
    id: 1,
    trip_id: 1,
    name: "Tokyo Station",
    address: null,
    google_maps_url: "https://www.google.com/maps",
    google_place_id: null,
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
