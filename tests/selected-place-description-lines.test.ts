import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observeDescriptionLines } from "@/components/map-panel/observe-description-lines";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  emit() {
    this.callback();
  }
}

function createFixture(availableHeight = 88) {
  const viewport = {
    height: availableHeight,
    getBoundingClientRect() {
      return { height: this.height };
    },
  };
  const fonts = new EventTarget();
  const description = {
    style: { setProperty: vi.fn(), visibility: "" },
    ownerDocument: { fonts },
  };
  const metrics = { lineHeight: "16.8px" };
  const viewportElement = viewport as unknown as HTMLElement;
  const descriptionElement = description as unknown as HTMLElement;
  vi.stubGlobal(
    "getComputedStyle",
    vi.fn(() => metrics),
  );

  const cleanup = observeDescriptionLines(viewportElement, descriptionElement);
  const observer = FakeResizeObserver.instances.at(-1)!;

  return {
    viewport,
    description,
    fonts,
    metrics,
    viewportElement,
    observer,
    cleanup,
  };
}

describe("observeDescriptionLines", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { height: 164, lines: 9 },
    { height: 144, lines: 8 },
    { height: 88, lines: 5 },
    { height: 68, lines: 4 },
    { height: 52, lines: 3 },
    { height: 16.8, lines: 1 },
    { height: 16.7, lines: 0 },
    { height: 0, lines: 0 },
    { height: 200, lines: 11 },
    { height: Number.NaN, lines: 0 },
    { height: Number.POSITIVE_INFINITY, lines: 0 },
  ])("fits complete lines in a $height px slot", ({ height, lines }) => {
    const { description, cleanup } = createFixture(height);

    expect(description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      String(Math.max(1, lines)),
    );
    expect(description.style.visibility).toBe(lines > 0 ? "visible" : "hidden");
    cleanup();
  });

  it.each(["normal", "0px", "-1px"])(
    "hides notes when line height cannot be measured from %s",
    (lineHeight) => {
      const fixture = createFixture();
      fixture.metrics.lineHeight = lineHeight;
      fixture.observer.emit();

      expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
        "--map-selected-card-note-lines",
        "1",
      );
      expect(fixture.description.style.visibility).toBe("hidden");
      fixture.cleanup();
    },
  );

  it("observes only the viewport and adapts when available space changes", () => {
    const fixture = createFixture();

    expect(fixture.observer.observe.mock.calls).toEqual([
      [fixture.viewportElement],
    ]);

    fixture.viewport.height = 68;
    fixture.observer.emit();
    expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      "4",
    );

    fixture.viewport.height = 0;
    fixture.observer.emit();
    expect(fixture.description.style.visibility).toBe("hidden");

    fixture.viewport.height = 88;
    fixture.observer.emit();
    expect(fixture.description.style.visibility).toBe("visible");
    expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      "5",
    );
    fixture.cleanup();
  });

  it("shows fewer complete lines when a wrapped title leaves less viewport height", () => {
    const fixture = createFixture(164);
    expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      "9",
    );

    fixture.viewport.height = 144;
    fixture.observer.emit();

    expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      "8",
    );
    fixture.cleanup();
  });

  it("remeasures line metrics when fonts finish loading", () => {
    const fixture = createFixture();
    fixture.metrics.lineHeight = "22px";
    fixture.fonts.dispatchEvent(new Event("loadingdone"));

    expect(fixture.description.style.setProperty).toHaveBeenLastCalledWith(
      "--map-selected-card-note-lines",
      "4",
    );
    fixture.cleanup();
  });

  it("disconnects and ignores queued notifications after cleanup", () => {
    const fixture = createFixture();
    const removeFontListener = vi.spyOn(fixture.fonts, "removeEventListener");
    fixture.cleanup();

    expect(fixture.observer.disconnect).toHaveBeenCalledOnce();
    expect(removeFontListener).toHaveBeenCalledWith(
      "loadingdone",
      expect.any(Function),
    );

    fixture.description.style.setProperty.mockClear();
    fixture.viewport.height = 0;
    fixture.observer.emit();
    fixture.fonts.dispatchEvent(new Event("loadingdone"));

    expect(fixture.description.style.setProperty).not.toHaveBeenCalled();
    expect(fixture.description.style.visibility).toBe("visible");
  });
});
