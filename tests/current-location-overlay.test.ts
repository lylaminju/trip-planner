import { afterEach, describe, expect, it, vi } from "vitest";

import { renderCurrentLocationMarker } from "@/components/map-panel/map-overlays";

describe("renderCurrentLocationMarker", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { window?: unknown }).window;
  });

  it("renders and removes the current-location marker without focusing the map", () => {
    const createdMarkers: FakeAdvancedMarkerElement[] = [];
    const map = {
      fitBounds: vi.fn(),
      panTo: vi.fn(),
    };
    const markerRecordRef = { current: null };

    (globalThis as { document?: unknown }).document = fakeDocument();
    (globalThis as { window?: unknown }).window = {
      google: {
        maps: {
          marker: {
            AdvancedMarkerElement: class extends FakeAdvancedMarkerElement {
              constructor(options: Record<string, unknown>) {
                super(options);
                createdMarkers.push(this);
              }
            },
          },
        },
      },
    };

    renderCurrentLocationMarker({
      map: map as unknown as google.maps.Map,
      position: { lat: 40.7128, lng: -74.006, accuracy: 10 },
      markerRecordRef,
    });

    expect(createdMarkers).toHaveLength(1);
    expect(createdMarkers[0].map).toBe(map);
    expect(createdMarkers[0].position).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.panTo).not.toHaveBeenCalled();

    renderCurrentLocationMarker({
      map: map as unknown as google.maps.Map,
      position: null,
      markerRecordRef,
    });

    expect(createdMarkers[0].map).toBeNull();
    expect(markerRecordRef.current).toBeNull();
  });
});

function fakeDocument() {
  return {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  };
}

class FakeElement {
  className = "";
  private attributes = new Map<string, string>();

  constructor(public tagName: string) {}

  append() {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class FakeAdvancedMarkerElement {
  map: unknown;
  position: unknown;

  constructor(options: Record<string, unknown>) {
    this.map = options.map;
    this.position = options.position;
  }
}
