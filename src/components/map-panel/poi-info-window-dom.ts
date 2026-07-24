// Tracks Google's native POI info window inside the map container.
//
// The card's contents render inside a closed shadow root
// (`gmp-internal-use-2d-map-place-details-compact`), so nothing in it — the
// place name included — is reachable from script. The name comes from a Place
// Details lookup instead. What *is* reachable is the outer container, which is
// all this module needs: it exists to say when the card opens and closes, so
// the "Add this place" chip can follow it.
//
// Our own saved-place info windows always contain `.place-info-window`, so a
// `:has()` guard keeps one of those from being mistaken for a POI card.
const OWN_INFO_WINDOW_GUARD = ":not(:has(.place-info-window))";

const POI_BOX_SELECTORS = [
  ".poi-info-window",
  `.gm-style-iw${OWN_INFO_WINDOW_GUARD}`,
];

function isPoiInfoWindowPresent(mapContainer: HTMLElement): boolean {
  return POI_BOX_SELECTORS.some(
    (selector) => mapContainer.querySelector(selector) !== null,
  );
}

/**
 * Watches the map container after a POI click and calls `onClosed` once the
 * native card disappears (the ✕ button, or a click elsewhere on the map).
 * Returns a cleanup function; callers start a fresh observer per click.
 */
export function observePoiInfoWindowClose(
  mapContainer: HTMLElement,
  onClosed: () => void,
): () => void {
  // Deliberately not seeded from the container's current state. Clicking a POI
  // while a previous card is still open makes Google tear that card down before
  // building the new one, leaving the container briefly boxless; treating that
  // gap as a close would dismiss the chip for the POI just clicked. Only a card
  // this observer has actually seen can close.
  let sawInfoWindow = false;
  let closed = false;

  function handleMutations() {
    if (closed) return;

    if (isPoiInfoWindowPresent(mapContainer)) {
      sawInfoWindow = true;
      return;
    }
    if (sawInfoWindow) {
      closed = true;
      onClosed();
    }
  }

  const observer = new MutationObserver(handleMutations);
  // Only the card's presence matters, so element add/remove is the whole
  // signal — no need to wake on the map's constant text mutations.
  observer.observe(mapContainer, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
  };
}
