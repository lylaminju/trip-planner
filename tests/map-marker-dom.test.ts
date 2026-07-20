import { afterEach, describe, expect, it } from "vitest";

import {
  currentLocationMarkerContent,
  poiAddChipContent,
} from "@/components/map-panel/map-marker-dom";

describe("currentLocationMarkerContent", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("creates a distinct compact current-location marker", () => {
    const document = fakeDocument();
    (globalThis as { document?: unknown }).document = document;

    const element = currentLocationMarkerContent();

    expect(element.className).toBe("current-location-marker");
    expect(
      Array.from(element.children).map((child) => child.className),
    ).toEqual(["current-location-marker-pulse", "current-location-marker-dot"]);
    expect(element.getAttribute("aria-label")).toBe("Current location");
  });
});

describe("poiAddChipContent", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("wraps the labeled pill in an offset anchor", () => {
    (globalThis as { document?: unknown }).document = fakeDocument();

    const element = poiAddChipContent();

    expect(element.className).toBe("map-poi-add-chip-anchor");
    const [chip] = Array.from(element.children) as HTMLElement[];
    expect(chip.className).toBe("map-poi-add-chip");
    const [plus, label] = Array.from(chip.children) as HTMLElement[];
    expect(plus.getAttribute("aria-hidden")).toBe("true");
    expect(plus.textContent).toBe("+");
    expect(label.textContent).toBe("Add this place");
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
  children: FakeElement[] = [];
  private attributes = new Map<string, string>();

  constructor(public tagName: string) {}

  append(...children: FakeElement[]) {
    this.children.push(...children);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}
