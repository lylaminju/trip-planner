import type { Place } from "@/lib/types";

export type MapPosition = {
  lat: number;
  lng: number;
};

export function getSelectedPlacePosition(
  places: Place[],
  activePlaceId: number | null,
): MapPosition | null {
  if (activePlaceId === null) {
    return null;
  }

  const place = places.find((item) => item.id === activePlaceId);
  return place ? { lat: place.latitude, lng: place.longitude } : null;
}
