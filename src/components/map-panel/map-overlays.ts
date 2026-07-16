import { MOBILE_MEDIA_QUERY } from "@/lib/breakpoints";
import type { CurrentLocationPosition } from "@/lib/current-location";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  RouteSegment,
} from "@/lib/types";

import {
  currentLocationMarkerContent,
  getInfoWindow,
  markerContent,
  openPlaceInfoWindow,
} from "./map-marker-dom";
import { routePath } from "./map-routes";
import {
  itemMarkerKey,
  markerSignature,
  placeMarkerKey,
  polylineSignature,
} from "./map-signatures";

const SINGLE_MARKER_INITIAL_ZOOM = 14;

export type MarkerRecord = {
  marker: any;
  element: HTMLElement;
  signature: string;
  date: string | null;
};

export type PolylineRecord = {
  polyline: any;
  signature: string;
  date: string | null;
};

export type CurrentLocationMarkerRecord = {
  marker: any;
  signature: string;
};

export function buildItemColors(itinerary: ItineraryView): Map<number, string> {
  const colors = new Map<number, string>();

  for (const day of itinerary.days) {
    for (const item of day.items) {
      colors.set(item.id, day.color);
    }
  }

  return colors;
}

export function createMap(
  container: HTMLElement,
  items: ItineraryItem[],
  unscheduledPlaces: Place[],
): any {
  const googleMaps = window.google;
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const firstPlace = items[0]?.place ?? unscheduledPlaces[0] ?? null;
  const center = firstPlace
    ? { lat: firstPlace.latitude, lng: firstPlace.longitude }
    : { lat: 20, lng: 0 };

  return new googleMaps.maps.Map(container, {
    center,
    mapTypeControl: !isMobile,
    zoom: firstPlace ? 12 : 2,
    mapId: "trip-planner-map",
  });
}

export function renderOverlays(input: {
  map: any;
  items: ItineraryItem[];
  unscheduledPlaces: Place[];
  mobileSheetState: MobileSheetState;
  routeSegments: RouteSegment[];
  routeGeometries: Map<number, RouteGeometry>;
  itemColors: Map<number, string>;
  markerLabels: Map<number, string>;
  markerRecords: Map<string, MarkerRecord>;
  polylines: Map<number, PolylineRecord>;
  boundsSignatureRef: { current: string };
  infoWindowRef: { current: any };
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
}): void {
  const googleMaps = window.google;
  if (!googleMaps?.maps) {
    return;
  }

  const bounds = new googleMaps.maps.LatLngBounds();
  const markerPositions: Array<{ lat: number; lng: number }> = [];
  const itemsById = new Map(input.items.map((item) => [item.id, item]));
  const nextMarkerKeys = new Set<string>();
  const infoWindow = getInfoWindow(input.infoWindowRef);

  for (const item of input.items) {
    const place = item.place;
    const position = { lat: place.latitude, lng: place.longitude };
    bounds.extend(position);
    markerPositions.push(position);
    const color = input.itemColors.get(item.id) ?? "#64748b";
    const label = input.markerLabels.get(item.id) ?? null;
    const markerKey = itemMarkerKey(item.id);
    nextMarkerKeys.add(markerKey);
    const signature = markerSignature(item, color, label, "scheduled");
    const existing = input.markerRecords.get(markerKey);

    if (existing?.signature === signature) {
      existing.date = item.visit_date;
      continue;
    }

    if (existing) existing.marker.map = null;

    const element = markerContent(color, label);
    const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
      map: input.map,
      position,
      title: place.name,
      content: element,
      gmpClickable: true,
    });
    marker.addEventListener("gmp-click", () => {
      input.onSelectPlace(item.id);
      openPlaceInfoWindow(input.map, marker, infoWindow, place);
    });
    input.markerRecords.set(markerKey, {
      marker,
      element,
      signature,
      date: item.visit_date,
    });
  }

  for (const place of input.unscheduledPlaces) {
    const position = { lat: place.latitude, lng: place.longitude };
    bounds.extend(position);
    markerPositions.push(position);
    const color = "#94a3b8";
    const markerKey = placeMarkerKey(place.id);
    nextMarkerKeys.add(markerKey);
    const signature = markerSignature(place, color, null, "unscheduled");
    const existing = input.markerRecords.get(markerKey);

    if (existing?.signature === signature) {
      existing.date = null;
      continue;
    }

    if (existing) existing.marker.map = null;

    const element = markerContent(color, null);
    const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
      map: input.map,
      position,
      title: place.name,
      content: element,
      gmpClickable: true,
    });
    marker.addEventListener("gmp-click", () => {
      openPlaceInfoWindow(input.map, marker, infoWindow, place);
    });
    input.markerRecords.set(markerKey, {
      marker,
      element,
      signature,
      date: null,
    });
  }

  for (const [markerKey, record] of input.markerRecords) {
    if (!nextMarkerKeys.has(markerKey)) {
      record.marker.map = null;
      input.markerRecords.delete(markerKey);
    }
  }

  const nextSegmentIds = new Set(
    input.routeSegments.map((segment) => segment.id),
  );
  for (const segment of input.routeSegments) {
    const from = itemsById.get(segment.from_item_id);
    const to = itemsById.get(segment.to_item_id);
    if (!from || !to) continue;

    const color = input.itemColors.get(from.id) ?? "#64748b";
    const routeGeometry = input.routeGeometries.get(segment.id);
    const signature = polylineSignature(
      segment,
      from.place,
      to.place,
      color,
      routeGeometry?.encoded_polyline,
    );
    const existing = input.polylines.get(segment.id);

    if (existing?.signature === signature) {
      existing.date = from.visit_date;
      continue;
    }

    if (existing) existing.polyline.setMap(null);

    const polyline = new googleMaps.maps.Polyline({
      map: input.map,
      path: routePath(from.place, to.place, routeGeometry),
      strokeColor: color,
      strokeOpacity: 0.55,
      strokeWeight: 3,
    });

    polyline.addListener("click", () => input.onSelectSegment(segment.id));
    input.polylines.set(segment.id, {
      polyline,
      signature,
      date: from.visit_date,
    });
  }

  for (const [segmentId, record] of input.polylines) {
    if (!nextSegmentIds.has(segmentId)) {
      record.polyline.setMap(null);
      input.polylines.delete(segmentId);
    }
  }

  if (!bounds.isEmpty() && input.boundsSignatureRef.current === "") {
    input.boundsSignatureRef.current = "initialized";
    if (markerPositions.length === 1) {
      input.map.panTo(markerPositions[0]);
      input.map.setZoom?.(SINGLE_MARKER_INITIAL_ZOOM);
      if (shouldOffsetFocusForHalfSheet(input.mobileSheetState)) {
        input.map.panBy(0, Math.round(window.innerHeight * 0.32));
      }
      return;
    }

    input.map.fitBounds(bounds, 48);
    if (shouldOffsetFocusForHalfSheet(input.mobileSheetState)) {
      window.google?.maps?.event?.addListenerOnce?.(input.map, "idle", () => {
        input.map.panBy(0, Math.round(window.innerHeight * 0.32));
      });
    }
  }
}

export function renderCurrentLocationMarker(input: {
  map: any;
  position: CurrentLocationPosition | null;
  markerRecordRef: { current: CurrentLocationMarkerRecord | null };
}): void {
  const existing = input.markerRecordRef.current;

  if (!input.position || !window.google?.maps) {
    if (existing) {
      existing.marker.map = null;
      input.markerRecordRef.current = null;
    }
    return;
  }

  const signature = [
    input.position.lat,
    input.position.lng,
    input.position.accuracy ?? "",
  ].join(":");
  if (existing?.signature === signature) {
    return;
  }

  if (existing) {
    existing.marker.map = null;
  }

  const marker = new window.google.maps.marker.AdvancedMarkerElement({
    map: input.map,
    position: { lat: input.position.lat, lng: input.position.lng },
    title: "Current location",
    content: currentLocationMarkerContent(),
    gmpClickable: false,
    zIndex: 900,
  });

  input.markerRecordRef.current = { marker, signature };
}

export function updateOverlaySelection(
  markerRecords: Map<string, MarkerRecord>,
  polylines: Map<number, PolylineRecord>,
  activePlaceId: number | null,
  activeCanonicalPlaceId: number | null,
  activeSegmentId: number | null,
  activeDate: string | null,
): void {
  for (const [markerKey, { element, marker, date }] of markerRecords) {
    const active =
      (activePlaceId !== null && markerKey === itemMarkerKey(activePlaceId)) ||
      (activeCanonicalPlaceId !== null &&
        markerKey === placeMarkerKey(activeCanonicalPlaceId));
    const dateSelected = activeDate !== null && date === activeDate;
    element.classList.toggle("active", active);
    element.classList.toggle(
      "date-active",
      activeDate !== null && date === activeDate,
    );
    marker.zIndex = active ? 1000 : dateSelected ? 100 : 1;
  }

  for (const [segmentId, { polyline, date }] of polylines) {
    const active = segmentId === activeSegmentId;
    const dimmed = activeDate !== null && date !== activeDate;
    const dateSelected = activeDate !== null && date === activeDate;

    polyline.setOptions({
      strokeOpacity: active ? 0.95 : dimmed ? 0.16 : dateSelected ? 0.82 : 0.55,
      strokeWeight: active ? 5 : dateSelected ? 4 : 3,
      zIndex: active ? 3 : dateSelected ? 2 : 1,
    });
  }
}

export function shouldOffsetFocusForHalfSheet(
  state: MobileSheetState,
): boolean {
  return (
    state === "half" &&
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );
}
