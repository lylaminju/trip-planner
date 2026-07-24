import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observePoiInfoWindowClose } from "@/components/map-panel/poi-info-window-dom";

// Simulates the map container: `boxPresent` mirrors Google's native POI info
// window existing in the DOM. Only its presence is observable — the card's
// contents live in a closed shadow root.
class FakeMapContainer {
  boxPresent = false;

  querySelector(selector: string): unknown {
    if (!this.boxPresent) return null;
    return selector === ".poi-info-window" ? {} : null;
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

describe("observePoiInfoWindowClose", () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    vi.stubGlobal("MutationObserver", FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires onClosed once when the box is removed", () => {
    const container = new FakeMapContainer();
    const onClosed = vi.fn();
    observePoiInfoWindowClose(container.asElement(), onClosed);

    container.boxPresent = true;
    lastObserver().emit();
    container.boxPresent = false;
    lastObserver().emit();
    lastObserver().emit();

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  // Clicking a second POI tears the first card down before the new one renders.
  // Treating that gap as a close would dismiss the chip for the POI just
  // clicked, which is the bug this guards.
  it("ignores the boxless gap while google swaps one card for another", () => {
    const container = new FakeMapContainer();
    container.boxPresent = true;
    const onClosed = vi.fn();
    observePoiInfoWindowClose(container.asElement(), onClosed);

    container.boxPresent = false;
    lastObserver().emit();
    expect(onClosed).not.toHaveBeenCalled();

    // The replacement card arrives and can then close normally.
    container.boxPresent = true;
    lastObserver().emit();
    container.boxPresent = false;
    lastObserver().emit();

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("stops observing on cleanup", () => {
    const container = new FakeMapContainer();
    const cleanup = observePoiInfoWindowClose(container.asElement(), vi.fn());

    expect(lastObserver().disconnected).toBe(false);
    cleanup();

    expect(lastObserver().disconnected).toBe(true);
  });
});
