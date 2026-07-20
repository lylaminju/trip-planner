import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachPoiClickListener,
  buildPoiPlaceSelection,
  renderPoiChipMarker,
} from "@/components/map-panel/useMapPoiPicker";

type FakeMapHarness = {
  map: Parameters<typeof attachPoiClickListener>[0];
  fireClick: (event: unknown) => void;
  remove: ReturnType<typeof vi.fn>;
};

function fakeMap(): FakeMapHarness {
  const handlers = new Map<string, (event: unknown) => void>();
  const remove = vi.fn();
  const map = {
    addListener: (name: string, handler: (event: unknown) => void) => {
      handlers.set(name, handler);
      return { remove };
    },
  } as unknown as Parameters<typeof attachPoiClickListener>[0];

  return {
    map,
    fireClick: (event) => handlers.get("click")!(event),
    remove,
  };
}

function latLng(lat: number, lng: number) {
  return { lat: () => lat, lng: () => lng };
}

describe("attachPoiClickListener", () => {
  it("reports a poi click with its place id and coordinates", () => {
    const harness = fakeMap();
    const onPoiClick = vi.fn();
    const onClear = vi.fn();
    attachPoiClickListener(harness.map, { onPoiClick, onClear });

    harness.fireClick({ placeId: "poi-123", latLng: latLng(37.7, -122.4) });

    expect(onPoiClick).toHaveBeenCalledWith({
      placeId: "poi-123",
      latitude: 37.7,
      longitude: -122.4,
      name: null,
    });
    expect(onClear).not.toHaveBeenCalled();
  });

  it("clears on plain map clicks and on poi clicks without coordinates", () => {
    const harness = fakeMap();
    const onPoiClick = vi.fn();
    const onClear = vi.fn();
    attachPoiClickListener(harness.map, { onPoiClick, onClear });

    harness.fireClick({ latLng: latLng(1, 2) });
    harness.fireClick({ placeId: "poi-123", latLng: null });

    expect(onPoiClick).not.toHaveBeenCalled();
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("removes the map listener on cleanup", () => {
    const harness = fakeMap();
    const cleanup = attachPoiClickListener(harness.map, {
      onPoiClick: vi.fn(),
      onClear: vi.fn(),
    });

    cleanup();

    expect(harness.remove).toHaveBeenCalledTimes(1);
  });
});

describe("buildPoiPlaceSelection", () => {
  it("builds a savable selection from a named poi", () => {
    const selection = buildPoiPlaceSelection({
      placeId: "poi-123",
      latitude: 37.7,
      longitude: -122.4,
      name: "Blue Bottle Coffee",
    });

    expect(selection).toEqual({
      place_id: "poi-123",
      name: "Blue Bottle Coffee",
      latitude: 37.7,
      longitude: -122.4,
      google_maps_url: "https://www.google.com/maps/place/?q=place_id%3Apoi-123",
    });
  });

  it("keeps the selection savable when no name could be read", () => {
    const selection = buildPoiPlaceSelection({
      placeId: "poi-123",
      latitude: 37.7,
      longitude: -122.4,
      name: null,
    });

    expect(selection.name).toBe("");
    expect(selection.place_id).toBe("poi-123");
  });
});

class FakeAdvancedMarkerElement {
  static instances: FakeAdvancedMarkerElement[] = [];
  map: unknown;
  listeners = new Map<string, () => void>();

  constructor(public options: Record<string, unknown>) {
    this.map = options.map;
    FakeAdvancedMarkerElement.instances.push(this);
  }

  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener);
  }
}

function stubMarkerGlobals() {
  FakeAdvancedMarkerElement.instances = [];
  (globalThis as { window?: unknown }).window = {
    google: {
      maps: { marker: { AdvancedMarkerElement: FakeAdvancedMarkerElement } },
    },
  };
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      className: "",
      append: () => {},
      setAttribute: () => {},
    }),
  };
}

describe("renderPoiChipMarker", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
  });

  it("anchors a clickable chip marker at the poi above other markers", () => {
    stubMarkerGlobals();
    const map = { fake: true };
    const onAdd = vi.fn();

    renderPoiChipMarker(
      map as unknown as Parameters<typeof renderPoiChipMarker>[0],
      { latitude: 37.7, longitude: -122.4 },
      onAdd,
    );

    const [marker] = FakeAdvancedMarkerElement.instances;
    expect(marker.options).toMatchObject({
      map,
      position: { lat: 37.7, lng: -122.4 },
      gmpClickable: true,
      title: "Add this place",
    });
    // Stays above the active place marker so the chip is always reachable.
    expect(marker.options.zIndex as number).toBeGreaterThan(1000);

    marker.listeners.get("gmp-click")!();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("removes the marker on cleanup", () => {
    stubMarkerGlobals();

    const cleanup = renderPoiChipMarker(
      { fake: true } as unknown as Parameters<typeof renderPoiChipMarker>[0],
      { latitude: 1, longitude: 2 },
      vi.fn(),
    );
    cleanup();

    expect(FakeAdvancedMarkerElement.instances[0].map).toBeNull();
  });

  it("is a no-op when the marker library is unavailable", () => {
    (globalThis as { window?: unknown }).window = {};

    expect(() =>
      renderPoiChipMarker(
        { fake: true } as unknown as Parameters<typeof renderPoiChipMarker>[0],
        { latitude: 1, longitude: 2 },
        vi.fn(),
      )(),
    ).not.toThrow();
  });
});
