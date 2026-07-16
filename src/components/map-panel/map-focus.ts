import { MOBILE_MEDIA_QUERY } from "@/lib/breakpoints";
import type { MobileSheetState } from "@/lib/mobile-sheet";

const HALF_SHEET_PAN_OFFSET_RATIO = 0.32;

type LatLngPosition = { lat: number; lng: number };

export function shouldOffsetFocusForHalfSheet(
  state: MobileSheetState,
): boolean {
  return (
    state === "half" &&
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );
}

export function panByHalfSheetOffset(map: google.maps.Map): void {
  map.panBy(0, Math.round(window.innerHeight * HALF_SHEET_PAN_OFFSET_RATIO));
}

/* Pans to a single distinct position or fits bounds around several, then
   offsets for the mobile half sheet. Returns a cleanup that removes the
   pending idle listener, if any. */
export function focusMapOnPositions(
  map: google.maps.Map,
  positions: LatLngPosition[],
  mobileSheetState: MobileSheetState,
  boundsPadding?: number,
): (() => void) | undefined {
  const seen = new Set<string>();
  const deduped = positions.filter((position) => {
    const key = `${position.lat},${position.lng}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  if (deduped.length === 0) {
    return undefined;
  }

  if (deduped.length === 1) {
    map.panTo(deduped[0]);
    if (shouldOffsetFocusForHalfSheet(mobileSheetState)) {
      panByHalfSheetOffset(map);
    }
    return undefined;
  }

  const bounds = new window.google!.maps.LatLngBounds();
  for (const position of deduped) {
    bounds.extend(position);
  }
  map.fitBounds(bounds, boundsPadding);

  if (!shouldOffsetFocusForHalfSheet(mobileSheetState)) {
    return undefined;
  }

  const idleListener = window.google!.maps.event?.addListenerOnce?.(
    map,
    "idle",
    () => panByHalfSheetOffset(map),
  );

  return () => {
    idleListener?.remove?.();
  };
}
