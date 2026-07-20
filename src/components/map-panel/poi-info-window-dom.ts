// Reads the place name out of Google's native POI info window. The map click
// event only exposes an opaque placeId; the name is available for free because
// the native info box already renders it inside our page. This whole module is
// a contract with undocumented Google DOM, so every selector lives here and
// every reader fails closed to `null` — callers must treat a missing name as
// "user types it manually".
//
// Google has shipped several markups for the POI card over the years, so the
// name is resolved through a fallback chain: the classic `.poi-info-window`
// structure, then the InfoWindow header slot, then the dialog's aria-label
// (which Google sets to the place name for screen readers). Our own saved-place
// info windows always contain `.place-info-window`, so `:has()` guards keep the
// chain from reading their titles.
const OWN_INFO_WINDOW_GUARD = ":not(:has(.place-info-window))";

export const POI_INFO_WINDOW_SELECTOR = ".poi-info-window";
export const POI_INFO_WINDOW_TITLE_SELECTOR = ".poi-info-window .title";
export const POI_NAME_READ_TIMEOUT_MS = 2000;

type PoiNameSource = {
  selector: string;
  attribute?: "aria-label";
};

export const POI_NAME_SOURCES: PoiNameSource[] = [
  { selector: POI_INFO_WINDOW_TITLE_SELECTOR },
  { selector: `.gm-style-iw${OWN_INFO_WINDOW_GUARD} .title` },
  { selector: `.gm-style-iw${OWN_INFO_WINDOW_GUARD} .gm-style-iw-ch` },
  { selector: `.gm-style-iw${OWN_INFO_WINDOW_GUARD}`, attribute: "aria-label" },
  {
    selector: `[role="dialog"][aria-label]${OWN_INFO_WINDOW_GUARD}`,
    attribute: "aria-label",
  },
];

const POI_BOX_SELECTORS = [
  POI_INFO_WINDOW_SELECTOR,
  `.gm-style-iw${OWN_INFO_WINDOW_GUARD}`,
];

type PoiInfoWindowCallbacks = {
  onName: (name: string) => void;
  onClosed: () => void;
};

export function readPoiInfoWindowName(
  mapContainer: HTMLElement,
): string | null {
  for (const source of POI_NAME_SOURCES) {
    const element = mapContainer.querySelector(source.selector);
    if (!element) continue;
    const raw = source.attribute
      ? element.getAttribute(source.attribute)
      : element.textContent;
    const text = raw?.trim();
    if (text) return text;
  }
  return null;
}

function isPoiInfoWindowPresent(mapContainer: HTMLElement): boolean {
  return POI_BOX_SELECTORS.some(
    (selector) => mapContainer.querySelector(selector) !== null,
  );
}

// Watches the map container after a POI click. The native box renders (or, when
// another POI was already open, mutates in place) asynchronously, so the name
// cannot be read synchronously at click time. Reports the name once via
// `onName` and fires `onClosed` when the box disappears (✕ button). Returns a
// cleanup function; callers start a fresh observer per click.
export function observePoiInfoWindow(
  mapContainer: HTMLElement,
  callbacks: PoiInfoWindowCallbacks,
): () => void {
  // A box left open from a previous POI click still shows the previous name;
  // map tile mutations can fire before Google swaps the box content in. Only
  // accept a name that differs from the initial one — the timeout below settles
  // the re-clicked-same-POI case where the title legitimately never changes.
  const initialName = readPoiInfoWindowName(mapContainer);
  const initialBoxPresent = isPoiInfoWindowPresent(mapContainer);
  let sawInfoWindow = initialBoxPresent;
  let reportedName = false;
  let closed = false;

  function reportName(name: string) {
    reportedName = true;
    callbacks.onName(name);
  }

  function handleMutations() {
    if (closed) return;

    if (!isPoiInfoWindowPresent(mapContainer)) {
      if (sawInfoWindow) {
        closed = true;
        callbacks.onClosed();
      }
      return;
    }

    sawInfoWindow = true;
    if (reportedName) return;

    const name = readPoiInfoWindowName(mapContainer);
    if (name && (!initialBoxPresent || name !== initialName)) {
      reportName(name);
    }
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(mapContainer, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  const timeoutId = setTimeout(() => {
    if (closed || reportedName) return;
    const name = readPoiInfoWindowName(mapContainer);
    if (name) {
      reportName(name);
    }
  }, POI_NAME_READ_TIMEOUT_MS);

  return () => {
    observer.disconnect();
    clearTimeout(timeoutId);
  };
}
