import { afterEach, describe, expect, it } from "vitest";

import { createMap } from "@/components/map-panel/map-overlays";

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
