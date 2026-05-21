import type { ItineraryItem, Place } from "@/lib/types";

export type MapPosition = {
  lat: number;
  lng: number;
};

export function getSelectedPlacePosition(
  items: ItineraryItem[],
  places: Place[],
  activeItemId: number | null,
  activePlaceId: number | null = null,
): MapPosition | null {
  if (activeItemId !== null) {
    const item = items.find((row) => row.id === activeItemId);
    return item
      ? { lat: item.place.latitude, lng: item.place.longitude }
      : null;
  }

  if (activePlaceId !== null) {
    const place = places.find((row) => row.id === activePlaceId);
    return place ? { lat: place.latitude, lng: place.longitude } : null;
  }

  return null;
}
