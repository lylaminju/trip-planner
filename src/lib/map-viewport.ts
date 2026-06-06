import type { ItineraryItem, Place, RouteSegment } from "@/lib/types";

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

export function getSelectedDatePositions(
  items: ItineraryItem[],
  activeDate: string | null,
): MapPosition[] {
  if (activeDate === null) return [];

  return items
    .filter((item) => item.visit_date === activeDate)
    .map((item) => ({ lat: item.place.latitude, lng: item.place.longitude }));
}

export function getSelectedSegmentPositions(
  items: ItineraryItem[],
  routeSegments: RouteSegment[],
  activeSegmentId: number | null,
): MapPosition[] {
  if (activeSegmentId === null) return [];

  const segment = routeSegments.find((row) => row.id === activeSegmentId);
  if (!segment) return [];

  const fromItem = items.find((item) => item.id === segment.from_item_id);
  const toItem = items.find((item) => item.id === segment.to_item_id);
  if (!fromItem || !toItem) return [];

  return [
    { lat: fromItem.place.latitude, lng: fromItem.place.longitude },
    { lat: toItem.place.latitude, lng: toItem.place.longitude },
  ];
}
