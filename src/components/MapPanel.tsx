"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { decodePolyline, type LatLngLiteral } from "@/lib/encoded-polyline";
import {
  buildTimedMarkerLabels,
  getMarkerSizing,
} from "@/lib/map-marker-labels";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import { getSelectedPlacePosition } from "@/lib/map-viewport";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  RouteSegment,
} from "@/lib/types";

type Props = {
  itinerary: ItineraryView;
  routeSegments: RouteSegment[];
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  mobileSheetState: MobileSheetState;
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
  hidden?: boolean;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
};

type MarkerRecord = {
  marker: any;
  element: HTMLElement;
  signature: string;
  date: string | null;
};

type PolylineRecord = {
  polyline: any;
  signature: string;
  date: string | null;
};

const GOOGLE_MAPS_CALLBACK = "__tripPlannerGoogleMapsReady";
let googleMapsLoadPromise: Promise<void> | null = null;

export function MapPanel(props: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRecordsRef = useRef<Map<string, MarkerRecord>>(new Map());
  const polylinesRef = useRef<Map<number, PolylineRecord>>(new Map());
  const boundsSignatureRef = useRef<string>("");
  const infoWindowRef = useRef<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const itineraryItems = useMemo(
    () => getItineraryItems(props.itinerary),
    [props.itinerary],
  );
  const itineraryItemsSignature = useMemo(
    () => buildItineraryItemsSignature(itineraryItems),
    [itineraryItems],
  );
  const unscheduledPlacesSignature = useMemo(
    () => buildPlacesSignature(props.itinerary.unscheduled),
    [props.itinerary.unscheduled],
  );
  const routeSegmentsSignature = useMemo(
    () => buildRouteSegmentsSignature(props.routeSegments),
    [props.routeSegments],
  );
  const itemColors = useMemo(
    () => buildItemColors(props.itinerary),
    [props.itinerary],
  );
  const markerLabels = useMemo(
    () => buildTimedMarkerLabels(props.itinerary),
    [props.itinerary],
  );
  useEffect(() => {
    if (!apiKey || !mapRef.current) {
      return;
    }

    let cancelled = false;
    setLoadFailed(false);

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) {
          return;
        }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = createMap(
            mapRef.current,
            itineraryItems,
            props.itinerary.unscheduled,
          );
        }
        setIsMapReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, itineraryItemsSignature, unscheduledPlacesSignature]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || !window.google?.maps) {
      return;
    }

    renderOverlays({
      map,
      items: itineraryItems,
      unscheduledPlaces: props.itinerary.unscheduled,
      mobileSheetState: props.mobileSheetState,
      routeSegments: props.routeSegments,
      routeGeometries: props.routeGeometries,
      itemColors,
      markerLabels,
      markerRecords: markerRecordsRef.current,
      polylines: polylinesRef.current,
      boundsSignatureRef,
      infoWindowRef,
      onSelectPlace: props.onSelectPlace,
      onSelectSegment: props.onSelectSegment,
    });
    updateOverlaySelection(
      markerRecordsRef.current,
      polylinesRef.current,
      props.activePlaceId,
      props.activeCanonicalPlaceId,
      props.activeSegmentId,
      props.activeDate,
    );
    updateMarkerSizes(markerRecordsRef.current, map.getZoom?.());
  }, [
    apiKey,
    itineraryItemsSignature,
    isMapReady,
    loadFailed,
    unscheduledPlacesSignature,
    routeSegmentsSignature,
    props.routeGeometries,
    itemColors,
    markerLabels,
    props.onSelectPlace,
    props.onSelectSegment,
    props.activeDate,
    props.activeCanonicalPlaceId,
    props.activePlaceId,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map) {
      return;
    }

    updateMarkerSizes(markerRecordsRef.current, map.getZoom?.());
    const listener = map.addListener?.("zoom_changed", () => {
      updateMarkerSizes(markerRecordsRef.current, map.getZoom?.());
    });

    return () => {
      listener?.remove?.();
    };
  }, [apiKey, isMapReady, loadFailed]);

  useEffect(() => {
    updateOverlaySelection(
      markerRecordsRef.current,
      polylinesRef.current,
      props.activePlaceId,
      props.activeCanonicalPlaceId,
      props.activeSegmentId,
      props.activeDate,
    );
  }, [
    props.activePlaceId,
    props.activeCanonicalPlaceId,
    props.activeSegmentId,
    props.activeDate,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map) {
      return;
    }

    if (!props.hidden) {
      window.google?.maps?.event?.trigger?.(map, "resize");
    }
  }, [apiKey, isMapReady, itineraryItemsSignature, loadFailed, props.hidden]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || props.hidden) {
      return;
    }

    const position = getSelectedPlacePosition(
      itineraryItems,
      props.itinerary.unscheduled,
      props.activePlaceId,
      props.activeCanonicalPlaceId,
    );
    if (position) {
      map.panTo(position);
      if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
        map.panBy(0, Math.round(window.innerHeight * 0.32));
      }
    }
  }, [
    apiKey,
    isMapReady,
    itineraryItemsSignature,
    loadFailed,
    props.activeCanonicalPlaceId,
    props.activePlaceId,
    props.hidden,
    props.mobileSheetState,
    unscheduledPlacesSignature,
  ]);

  if (!apiKey || loadFailed) {
    return (
      <CoordinateFallback
        items={itineraryItems}
        unscheduledPlaces={props.itinerary.unscheduled}
      />
    );
  }

  return (
    <section
      className={`panel panel-map ${props.hidden ? "panel-map-hidden" : ""}`}
      aria-label="Google map"
      aria-hidden={props.hidden}
    >
      <div className="map-canvas" ref={mapRef} />
      {props.routeGeometryError && (
        <div className="map-route-warning">
          <p>{props.routeGeometryError}</p>
        </div>
      )}
    </section>
  );
}

function CoordinateFallback({
  items,
  unscheduledPlaces,
}: {
  items: ItineraryItem[];
  unscheduledPlaces: Place[];
}) {
  return (
    <section className="panel panel-map map-fallback">
      <h2>Coordinates</h2>
      {items.map((item) => (
        <p key={item.id}>
          <strong>{item.place.name}</strong>: {item.place.latitude},{" "}
          {item.place.longitude}
        </p>
      ))}
      {unscheduledPlaces.map((place) => (
        <p key={place.id}>
          <strong>{place.name}</strong>: {place.latitude}, {place.longitude}
        </p>
      ))}
    </section>
  );
}

function buildItemColors(itinerary: ItineraryView): Map<number, string> {
  const colors = new Map<number, string>();

  for (const day of itinerary.days) {
    for (const item of day.items) {
      colors.set(item.id, day.color);
    }
  }

  return colors;
}

function createMap(
  container: HTMLElement,
  items: ItineraryItem[],
  unscheduledPlaces: Place[],
): any {
  const googleMaps = window.google;
  const firstPlace = items[0]?.place ?? unscheduledPlaces[0] ?? null;
  const center = firstPlace
    ? { lat: firstPlace.latitude, lng: firstPlace.longitude }
    : { lat: 40.7128, lng: -74.006 };

  return new googleMaps.maps.Map(container, {
    center,
    zoom: 12,
    mapId: "trip-planner-map",
  });
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (isGoogleMapsReady()) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollId: number | null = null;
    let timeoutId: number | null = null;

    function cleanup() {
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      delete window[GOOGLE_MAPS_CALLBACK];
    }

    function finish() {
      if (settled || !isGoogleMapsReady()) return;

      settled = true;
      cleanup();
      resolve();
    }

    function fail() {
      if (settled) return;

      settled = true;
      googleMapsLoadPromise = null;
      cleanup();
      reject(new Error("Google Maps failed to load"));
    }

    window[GOOGLE_MAPS_CALLBACK] = finish;
    pollId = window.setInterval(finish, 50);
    timeoutId = window.setTimeout(fail, 10000);

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps]",
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function isGoogleMapsReady(): boolean {
  return Boolean(
    window.google?.maps?.Map &&
    window.google.maps.marker?.AdvancedMarkerElement,
  );
}

function renderOverlays(input: {
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
  const itemsById = new Map(input.items.map((item) => [item.id, item]));
  const nextMarkerKeys = new Set<string>();
  const infoWindow = getInfoWindow(input.infoWindowRef);

  for (const item of input.items) {
    const place = item.place;
    const position = { lat: place.latitude, lng: place.longitude };
    bounds.extend(position);
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
    input.map.fitBounds(bounds, 48);
    if (shouldOffsetFocusForHalfSheet(input.mobileSheetState)) {
      window.google?.maps?.event?.addListenerOnce?.(input.map, "idle", () => {
        input.map.panBy(0, Math.round(window.innerHeight * 0.32));
      });
    }
  }
}

function markerSignature(
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

function polylineSignature(
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

function routePath(
  from: Place,
  to: Place,
  geometry: RouteGeometry | undefined,
): LatLngLiteral[] {
  if (geometry?.status === "ok" && geometry.encoded_polyline) {
    try {
      const path = decodePolyline(geometry.encoded_polyline);
      if (path.length > 1) {
        return path;
      }
    } catch {
      return straightRoutePath(from, to);
    }
  }

  return straightRoutePath(from, to);
}

function straightRoutePath(from: Place, to: Place): LatLngLiteral[] {
  return [
    { lat: from.latitude, lng: from.longitude },
    { lat: to.latitude, lng: to.longitude },
  ];
}

function updateOverlaySelection(
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

function getItineraryItems(itinerary: ItineraryView): ItineraryItem[] {
  return itinerary.days.flatMap((day) => day.items);
}

function buildItineraryItemsSignature(items: ItineraryItem[]): string {
  return items
    .map(
      (item) =>
        `item:${item.id}:${item.place.latitude},${item.place.longitude}:${item.visit_date ?? ""}:${item.visit_time ?? ""}`,
    )
    .join(";");
}

function buildPlacesSignature(places: Place[]): string {
  return places
    .map((place) => `place:${place.id}:${place.latitude},${place.longitude}`)
    .join(";");
}

function shouldOffsetFocusForHalfSheet(state: MobileSheetState): boolean {
  return (
    state === "half" &&
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 900px)").matches
  );
}

function buildRouteSegmentsSignature(segments: RouteSegment[]): string {
  return segments
    .map(
      (segment) =>
        `segment:${segment.id}:${segment.from_item_id}->${segment.to_item_id}:${segment.mode}`,
    )
    .join(";");
}

function updateMarkerSizes(
  markerRecords: Map<string, MarkerRecord>,
  zoom: number | undefined,
): void {
  const sizing = getMarkerSizing(zoom);

  for (const { element } of markerRecords.values()) {
    element.style.setProperty("--map-marker-size", `${sizing.size}px`);
    element.style.setProperty(
      "--map-marker-active-size",
      `${sizing.activeSize}px`,
    );
    element.style.setProperty("--map-marker-font-size", `${sizing.fontSize}px`);
    element.style.setProperty(
      "--map-marker-active-font-size",
      `${sizing.activeFontSize}px`,
    );
  }
}

function markerContent(color: string, label: string | null): HTMLElement {
  const element = document.createElement("div");
  element.className = "map-marker";
  element.style.backgroundColor = color;
  if (label) {
    element.textContent = label;
  }

  return element;
}

function itemMarkerKey(itemId: number | null): string {
  return `item:${itemId ?? "none"}`;
}

function placeMarkerKey(placeId: number): string {
  return `place:${placeId}`;
}

function getInfoWindow(infoWindowRef: { current: any }): any {
  const googleMaps = window.google;

  if (!infoWindowRef.current) {
    infoWindowRef.current = new googleMaps.maps.InfoWindow();
  }

  return infoWindowRef.current;
}

function openPlaceInfoWindow(
  map: any,
  marker: any,
  infoWindow: any,
  place: Place,
): void {
  infoWindow.setContent(placeInfoWindowContent(place));
  infoWindow.open({ anchor: marker, map });
}

function placeInfoWindowContent(place: Place): HTMLElement {
  const container = document.createElement("div");
  container.className = "place-info-window";

  const name = document.createElement("strong");
  name.textContent = place.name;

  const link = document.createElement("a");
  link.href = place.google_maps_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open in Google Maps";

  container.append(name, link);
  return container;
}

declare global {
  interface Window {
    google?: any;
    __tripPlannerGoogleMapsReady?: () => void;
  }
}
