import type { ItineraryItem } from "@/lib/types";

export type MapPosition = {
  lat: number;
  lng: number;
};

export function getSelectedPlacePosition(
  items: ItineraryItem[],
  activeItemId: number | null,
): MapPosition | null {
  if (activeItemId === null) {
    return null;
  }

  const item = items.find((row) => row.id === activeItemId);
  return item ? { lat: item.place.latitude, lng: item.place.longitude } : null;
}
