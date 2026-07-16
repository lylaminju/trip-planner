import type { DestinationFocus } from "@/lib/destination-options";
import type { MobileSheetState } from "@/lib/mobile-sheet";

import { shouldOffsetFocusForHalfSheet } from "./map-overlays";

// Frame the whole destination city/region using its catalog coordinates.
export function focusMapOnDestination(
  map: google.maps.Map,
  focus: DestinationFocus,
  mobileSheetState: MobileSheetState,
): void {
  map.setCenter({ lat: focus.latitude, lng: focus.longitude });
  map.setZoom?.(focus.zoom);

  if (shouldOffsetFocusForHalfSheet(mobileSheetState)) {
    window.google?.maps?.event?.addListenerOnce?.(map, "idle", () => {
      map.panBy(0, Math.round(window.innerHeight * 0.32));
    });
  }
}
