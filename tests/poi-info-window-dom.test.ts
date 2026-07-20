import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  observePoiInfoWindow,
  POI_INFO_WINDOW_SELECTOR,
  POI_INFO_WINDOW_TITLE_SELECTOR,
  POI_NAME_READ_TIMEOUT_MS,
  POI_NAME_SOURCES,
  readPoiInfoWindowName,
} from "@/components/map-panel/poi-info-window-dom";

// Simulates the map container: `boxPresent` mirrors Google's native POI info
// window existing in the DOM, `title` its name text.
class FakeMapContainer {
  boxPresent = false;
  title = "";

  querySelector(selector: string): unknown {
    if (!this.boxPresent) return null;
    if (selector === POI_INFO_WINDOW_SELECTOR) return {};
    if (selector === POI_INFO_WINDOW_TITLE_SELECTOR) {
      return { textContent: this.title };
    }
    return null;
  }

  asElement(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeMutationObserver.instances.push(this);
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }

  emit() {
    this.callback();
  }
}

function lastObserver(): FakeMutationObserver {
  const observer = FakeMutationObserver.instances.at(-1);
  expect(observer).toBeDefined();
  return observer!;
}

describe("readPoiInfoWindowName", () => {
  it("returns the trimmed native box title", () => {
    const container = new FakeMapContainer();
    container.boxPresent = true;
    container.title = "  Blue Bottle Coffee  ";

    expect(readPoiInfoWindowName(container.asElement())).toBe(
      "Blue Bottle Coffee",
    );
  });

  it("fails closed when the box or title is missing", () => {
    const container = new FakeMapContainer();
    expect(readPoiInfoWindowName(container.asElement())).toBeNull();

    container.boxPresent = true;
    container.title = "";
    expect(readPoiInfoWindowName(container.asElement())).toBeNull();
  });

  it("falls back to the info window header when classic markup is gone", () => {
    const headerSource = POI_NAME_SOURCES.find((source) =>
      source.selector.includes("gm-style-iw-ch"),
    )!;
    const container = fakeContainer({
      [headerSource.selector]: { text: "Blue Bottle Coffee" },
    });

    expect(readPoiInfoWindowName(container)).toBe("Blue Bottle Coffee");
  });

  it("falls back to the dialog aria-label as a last resort", () => {
    const ariaSource = POI_NAME_SOURCES.find(
      (source) => source.attribute === "aria-label",
    )!;
    const container = fakeContainer({
      [ariaSource.selector]: { ariaLabel: "Blue Bottle Coffee" },
    });

    expect(readPoiInfoWindowName(container)).toBe("Blue Bottle Coffee");
  });
});

function fakeContainer(
  nodes: Record<string, { text?: string; ariaLabel?: string }>,
): HTMLElement {
  return {
    querySelector(selector: string) {
      const node = nodes[selector];
      if (!node) return null;
      return {
        textContent: node.text ?? null,
        getAttribute: (name: string) =>
          name === "aria-label" ? (node.ariaLabel ?? null) : null,
      };
    },
  } as unknown as HTMLElement;
}

describe("observePoiInfoWindow", () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    vi.stubGlobal("MutationObserver", FakeMutationObserver);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports the name once when the box renders after the click", () => {
    const container = new FakeMapContainer();
    const onName = vi.fn();
    observePoiInfoWindow(container.asElement(), { onName, onClosed: vi.fn() });

    container.boxPresent = true;
    container.title = "Blue Bottle Coffee";
    lastObserver().emit();
    lastObserver().emit();

    expect(onName).toHaveBeenCalledTimes(1);
    expect(onName).toHaveBeenCalledWith("Blue Bottle Coffee");
  });

  it("ignores the stale title of a previously open box until it changes", () => {
    const container = new FakeMapContainer();
    container.boxPresent = true;
    container.title = "Previous place";
    const onName = vi.fn();
    observePoiInfoWindow(container.asElement(), { onName, onClosed: vi.fn() });

    // Map tile mutation fires before Google swaps the box content in.
    lastObserver().emit();
    expect(onName).not.toHaveBeenCalled();

    container.title = "Next place";
    lastObserver().emit();
    expect(onName).toHaveBeenCalledWith("Next place");
  });

  it("accepts the unchanged title after the timeout for a re-clicked poi", () => {
    const container = new FakeMapContainer();
    container.boxPresent = true;
    container.title = "Same place";
    const onName = vi.fn();
    observePoiInfoWindow(container.asElement(), { onName, onClosed: vi.fn() });

    vi.advanceTimersByTime(POI_NAME_READ_TIMEOUT_MS);

    expect(onName).toHaveBeenCalledWith("Same place");
  });

  it("fires onClosed once when the box is removed", () => {
    const container = new FakeMapContainer();
    const onClosed = vi.fn();
    observePoiInfoWindow(container.asElement(), {
      onName: vi.fn(),
      onClosed,
    });

    container.boxPresent = true;
    container.title = "Blue Bottle Coffee";
    lastObserver().emit();
    container.boxPresent = false;
    lastObserver().emit();
    lastObserver().emit();

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("stops observing and cancels the timeout on cleanup", () => {
    const container = new FakeMapContainer();
    container.boxPresent = true;
    container.title = "Blue Bottle Coffee";
    const onName = vi.fn();
    const cleanup = observePoiInfoWindow(container.asElement(), {
      onName,
      onClosed: vi.fn(),
    });

    cleanup();
    vi.advanceTimersByTime(POI_NAME_READ_TIMEOUT_MS);

    expect(lastObserver().disconnected).toBe(true);
    expect(onName).not.toHaveBeenCalled();
  });
});
