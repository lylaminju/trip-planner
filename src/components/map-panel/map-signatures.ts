import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteSegment,
} from "@/lib/types";

export function markerSignature(
  item: ItineraryItem | Place,
  color: string,
  label: string | null,
  variant: "scheduled" | "unscheduled",
): string {
  return [
    variant,
    item.id,
    "place" in item ? item.place.name : item.name,
    "place" in item ? item.place.google_maps_url : item.google_maps_url,
    "place" in item ? item.place.latitude : item.latitude,
    "place" in item ? item.place.longitude : item.longitude,
    color,
    label ?? "",
  ].join("|");
}

export function polylineSignature(
  segment: RouteSegment,
  from: Place,
  to: Place,
  color: string,
  encodedPolyline?: string,
): string {
  return [
    segment.from_item_id,
    segment.to_item_id,
    segment.mode,
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
    color,
    encodedPolyline ?? "",
  ].join("|");
}

export function itemMarkerKey(itemId: number | null): string {
  return `item:${itemId ?? "none"}`;
}

export function placeMarkerKey(placeId: number): string {
  return `place:${placeId}`;
}

export function getItineraryItems(itinerary: ItineraryView): ItineraryItem[] {
  return itinerary.days.flatMap((day) => day.items);
}

export function buildItineraryItemsSignature(items: ItineraryItem[]): string {
  return items
    .map(
      (item) =>
        `item:${item.id}:${item.place.latitude},${item.place.longitude}:${item.visit_date ?? ""}:${item.visit_time ?? ""}`,
    )
    .join(";");
}

export function buildPlacesSignature(places: Place[]): string {
  return places
    .map((place) => `place:${place.id}:${place.latitude},${place.longitude}`)
    .join(";");
}

export function buildRouteSegmentsSignature(segments: RouteSegment[]): string {
  return segments
    .map(
      (segment) =>
        `segment:${segment.id}:${segment.from_item_id}->${segment.to_item_id}:${segment.mode}`,
    )
    .join(";");
}
