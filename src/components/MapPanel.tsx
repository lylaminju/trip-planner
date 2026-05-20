"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { decodePolyline, type LatLngLiteral } from "@/lib/encoded-polyline";
import { buildTimedMarkerLabels, getMarkerSizing } from "@/lib/map-marker-labels";
import { getSelectedPlacePosition } from "@/lib/map-viewport";
import type { ItineraryView, Place, RouteGeometry, RouteSegment, TravelMode } from "@/lib/types";

type Props = {
  places: Place[];
  itinerary: ItineraryView;
  routeSegments: RouteSegment[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
};

type MarkerRecord = {
  marker: any;
  element: HTMLElement;
  signature: string;
};

type PolylineRecord = {
  polyline: any;
  signature: string;
};

type RouteGeometryFetchResult = {
  geometry: RouteGeometry | null;
  error: string | null;
};

export function MapPanel(props: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRecordsRef = useRef<Map<number, MarkerRecord>>(new Map());
  const polylinesRef = useRef<Map<number, PolylineRecord>>(new Map());
  const routeGeometrySignaturesRef = useRef<Map<number, string>>(new Map());
  const boundsSignatureRef = useRef<string>("");
  const infoWindowRef = useRef<any>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routeGeometries, setRouteGeometries] = useState<Map<number, RouteGeometry>>(new Map());
  const [routeGeometryError, setRouteGeometryError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const placeColors = useMemo(() => buildPlaceColors(props.itinerary), [props.itinerary]);
  const markerLabels = useMemo(() => buildTimedMarkerLabels(props.itinerary), [props.itinerary]);
  const showRouteQualityWarning = useMemo(
    () => props.routeSegments.some((segment) => isBetaRouteMode(segment.mode)),
    [props.routeSegments],
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
          mapInstanceRef.current = createMap(mapRef.current, props.places);
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
  }, [apiKey, props.places]);

  useEffect(() => {
    if (!apiKey || loadFailed || !isMapReady) {
      return;
    }

    let cancelled = false;
    const placesById = new Map(props.places.map((place) => [place.id, place]));
    const nextSegmentIds = new Set(props.routeSegments.map((segment) => segment.id));
    const changedSegmentIds = new Set<number>();
    const requests: Promise<RouteGeometryFetchResult>[] = [];

    for (const segment of props.routeSegments) {
      const from = placesById.get(segment.from_place_id);
      const to = placesById.get(segment.to_place_id);
      if (!from || !to) continue;

      const signature = routeGeometryRequestSignature(segment, from, to);
      if (routeGeometrySignaturesRef.current.get(segment.id) === signature) {
        continue;
      }

      changedSegmentIds.add(segment.id);
      routeGeometrySignaturesRef.current.set(segment.id, signature);
      requests.push(fetchRouteGeometry(segment.id));
    }

    for (const segmentId of routeGeometrySignaturesRef.current.keys()) {
      if (!nextSegmentIds.has(segmentId)) {
        routeGeometrySignaturesRef.current.delete(segmentId);
      }
    }

    setRouteGeometries((current) => {
      const next = new Map(current);
      let changed = false;

      for (const segmentId of current.keys()) {
        if (!nextSegmentIds.has(segmentId) || changedSegmentIds.has(segmentId)) {
          next.delete(segmentId);
          changed = true;
        }
      }

      return changed ? next : current;
    });

    if (props.routeSegments.length === 0) {
      setRouteGeometryError(null);
    }

    if (requests.length > 0) {
      void Promise.all(requests).then((results) => {
        if (cancelled) return;

        setRouteGeometryError(results.find((result) => result.error)?.error ?? null);
        setRouteGeometries((current) => {
          const next = new Map(current);
          let changed = false;

          for (const { geometry } of results) {
            if (geometry?.status !== "ok") continue;

            next.set(geometry.segment_id, geometry);
            changed = true;
          }

          return changed ? next : current;
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [apiKey, isMapReady, loadFailed, props.places, props.routeSegments]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || !window.google?.maps) {
      return;
    }

    renderOverlays({
      map,
      places: props.places,
      routeSegments: props.routeSegments,
      routeGeometries,
      placeColors,
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
      props.activeSegmentId,
    );
    updateMarkerSizes(markerRecordsRef.current, map.getZoom?.());
  }, [
    apiKey,
    isMapReady,
    loadFailed,
    props.places,
    props.routeSegments,
    routeGeometries,
    placeColors,
    markerLabels,
    props.onSelectPlace,
    props.onSelectSegment,
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
      props.activeSegmentId,
    );
  }, [props.activePlaceId, props.activeSegmentId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map) {
      return;
    }

    const position = getSelectedPlacePosition(props.places, props.activePlaceId);
    if (position) {
      map.panTo(position);
    }
  }, [apiKey, isMapReady, loadFailed, props.activePlaceId, props.places]);

  if (!apiKey || loadFailed) {
    return <CoordinateFallback places={props.places} />;
  }

  return (
    <section className="panel panel-map" aria-label="Google map">
      <div className="map-canvas" ref={mapRef} />
      {(routeGeometryError || showRouteQualityWarning) && (
        <div className="map-route-warning">
          {routeGeometryError && <p>{routeGeometryError}</p>}
          {showRouteQualityWarning && (
            <p>Walking and bicycling routes may be missing sidewalks, pedestrian paths, or bike paths.</p>
          )}
        </div>
      )}
    </section>
  );
}

function CoordinateFallback({ places }: { places: Place[] }) {
  return (
    <section className="panel panel-map map-fallback">
      <h2>Coordinates</h2>
      {places.map((place) => (
        <p key={place.id}>
          <strong>{place.name}</strong>: {place.latitude}, {place.longitude}
        </p>
      ))}
    </section>
  );
}

function buildPlaceColors(itinerary: ItineraryView): Map<number, string> {
  const colors = new Map<number, string>();

  for (const day of itinerary.days) {
    for (const place of day.places) {
      colors.set(place.id, day.color);
    }
  }

  return colors;
}

function createMap(container: HTMLElement, places: Place[]): any {
  const googleMaps = window.google;
  const center = places[0]
    ? { lat: places[0].latitude, lng: places[0].longitude }
    : { lat: 40.7128, lng: -74.006 };

  return new googleMaps.maps.Map(container, { center, zoom: 12, mapId: "trip-planner-map" });
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

async function fetchRouteGeometry(segmentId: number): Promise<RouteGeometryFetchResult> {
  try {
    const response = await fetch(`/api/route-segments/${segmentId}/geometry`);
    if (!response.ok) {
      return {
        geometry: null,
        error:
          response.status === 503
            ? "Real routes need a server-side Google Routes API key. Showing straight lines for now."
            : "Real routes are unavailable from Google right now. Showing straight lines for now.",
      };
    }

    const geometry = (await response.json()) as RouteGeometry;
    return {
      geometry: geometry.segment_id === segmentId ? geometry : null,
      error: null,
    };
  } catch {
    return {
      geometry: null,
      error: "Real routes are unavailable from Google right now. Showing straight lines for now.",
    };
  }
}

function renderOverlays(input: {
  map: any;
  places: Place[];
  routeSegments: RouteSegment[];
  routeGeometries: Map<number, RouteGeometry>;
  placeColors: Map<number, string>;
  markerLabels: Map<number, string>;
  markerRecords: Map<number, MarkerRecord>;
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
  const placesById = new Map(input.places.map((place) => [place.id, place]));
  const nextPlaceIds = new Set(input.places.map((place) => place.id));
  const infoWindow = getInfoWindow(input.infoWindowRef);

  for (const place of input.places) {
    const position = { lat: place.latitude, lng: place.longitude };
    bounds.extend(position);
    const color = input.placeColors.get(place.id) ?? "#64748b";
    const label = input.markerLabels.get(place.id) ?? null;
    const signature = markerSignature(place, color, label);
    const existing = input.markerRecords.get(place.id);

    if (existing?.signature === signature) {
      continue;
    }

    if (existing) existing.marker.map = null;

    const element = markerContent(color, label);
    const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
      map: input.map,
      position,
      title: place.name,
      content: element,
    });
    marker.addListener("click", () => {
      input.onSelectPlace(place.id);
      openPlaceInfoWindow(input.map, marker, infoWindow, place);
    });
    input.markerRecords.set(place.id, { marker, element, signature });
  }

  for (const [placeId, record] of input.markerRecords) {
    if (!nextPlaceIds.has(placeId)) {
      record.marker.map = null;
      input.markerRecords.delete(placeId);
    }
  }

  const nextSegmentIds = new Set(input.routeSegments.map((segment) => segment.id));
  for (const segment of input.routeSegments) {
    const from = placesById.get(segment.from_place_id);
    const to = placesById.get(segment.to_place_id);
    if (!from || !to) continue;

    const color = input.placeColors.get(from.id) ?? "#64748b";
    const routeGeometry = input.routeGeometries.get(segment.id);
    const signature = polylineSignature(segment, from, to, color, routeGeometry?.encoded_polyline);
    const existing = input.polylines.get(segment.id);

    if (existing?.signature === signature) {
      continue;
    }

    if (existing) existing.polyline.setMap(null);

    const polyline = new googleMaps.maps.Polyline({
      map: input.map,
      path: routePath(from, to, routeGeometry),
      strokeColor: color,
      strokeOpacity: 0.55,
      strokeWeight: 3,
    });

    polyline.addListener("click", () => input.onSelectSegment(segment.id));
    input.polylines.set(segment.id, { polyline, signature });
  }

  for (const [segmentId, record] of input.polylines) {
    if (!nextSegmentIds.has(segmentId)) {
      record.polyline.setMap(null);
      input.polylines.delete(segmentId);
    }
  }

  const nextBoundsSignature = boundsSignature(input.places);
  if (!bounds.isEmpty() && nextBoundsSignature !== input.boundsSignatureRef.current) {
    input.boundsSignatureRef.current = nextBoundsSignature;
    input.map.fitBounds(bounds, 48);
  }
}

function markerSignature(place: Place, color: string, label: string | null): string {
  return [place.name, place.google_maps_url, place.latitude, place.longitude, color, label ?? ""].join("|");
}

function polylineSignature(
  segment: RouteSegment,
  from: Place,
  to: Place,
  color: string,
  encodedPolyline?: string,
): string {
  return [
    segment.from_place_id,
    segment.to_place_id,
    segment.mode,
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
    color,
    encodedPolyline ?? "",
  ].join("|");
}

function routePath(from: Place, to: Place, geometry: RouteGeometry | undefined): LatLngLiteral[] {
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

function routeGeometryRequestSignature(segment: RouteSegment, from: Place, to: Place): string {
  return [
    segment.mode,
    coordinateKey(from.latitude),
    coordinateKey(from.longitude),
    coordinateKey(to.latitude),
    coordinateKey(to.longitude),
  ].join("|");
}

function coordinateKey(value: number): string {
  return value.toFixed(6);
}

function isBetaRouteMode(mode: TravelMode): boolean {
  return mode === "walking" || mode === "bicycling";
}

function boundsSignature(places: Place[]): string {
  return places
    .map((place) => `${place.id}:${place.latitude},${place.longitude}`)
    .sort()
    .join(";");
}

function updateOverlaySelection(
  markerRecords: Map<number, MarkerRecord>,
  polylines: Map<number, PolylineRecord>,
  activePlaceId: number | null,
  activeSegmentId: number | null,
): void {
  for (const [placeId, { element }] of markerRecords) {
    element.classList.toggle("active", placeId === activePlaceId);
  }

  for (const [segmentId, { polyline }] of polylines) {
    const active = segmentId === activeSegmentId;
    polyline.setOptions({
      strokeOpacity: active ? 0.95 : 0.55,
      strokeWeight: active ? 5 : 3,
    });
  }
}

function updateMarkerSizes(markerRecords: Map<number, MarkerRecord>, zoom: number | undefined): void {
  const sizing = getMarkerSizing(zoom);

  for (const { element } of markerRecords.values()) {
    element.style.setProperty("--map-marker-size", `${sizing.size}px`);
    element.style.setProperty("--map-marker-active-size", `${sizing.activeSize}px`);
    element.style.setProperty("--map-marker-font-size", `${sizing.fontSize}px`);
    element.style.setProperty("--map-marker-active-font-size", `${sizing.activeFontSize}px`);
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

function getInfoWindow(infoWindowRef: { current: any }): any {
  const googleMaps = window.google;

  if (!infoWindowRef.current) {
    infoWindowRef.current = new googleMaps.maps.InfoWindow();
  }

  return infoWindowRef.current;
}

function openPlaceInfoWindow(map: any, marker: any, infoWindow: any, place: Place): void {
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
  }
}
