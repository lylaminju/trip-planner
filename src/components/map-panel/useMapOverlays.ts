import { useEffect, useRef } from "react";

import type { CurrentLocationPosition } from "@/lib/current-location";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type {
  ItineraryItem,
  Place,
  RouteGeometry,
  RouteSegment,
} from "@/lib/types";

import { updateMarkerSizes } from "./map-marker-dom";
import {
  renderCurrentLocationMarker,
  renderOverlays,
  updateOverlaySelection,
  type CurrentLocationMarkerRecord,
  type MarkerRecord,
  type PolylineRecord,
} from "./map-overlays";

export function useMapOverlays(input: {
  apiKey: string | undefined;
  isMapReady: boolean;
  loadFailed: boolean;
  mapInstanceRef: { current: google.maps.Map | null };
  itineraryItems: ItineraryItem[];
  itineraryItemsSignature: string;
  unscheduledPlaces: Place[];
  unscheduledPlacesSignature: string;
  routeSegments: RouteSegment[];
  routeSegmentsSignature: string;
  routeGeometries: Map<number, RouteGeometry>;
  itemColors: Map<number, string>;
  markerLabels: Map<number, string>;
  mobileSheetState: MobileSheetState;
  currentLocationPosition: CurrentLocationPosition | null;
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
}): void {
  const markerRecordsRef = useRef<Map<string, MarkerRecord>>(new Map());
  const polylinesRef = useRef<Map<number, PolylineRecord>>(new Map());
  const currentLocationMarkerRef = useRef<CurrentLocationMarkerRecord | null>(
    null,
  );
  const boundsSignatureRef = useRef<string>("");
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const { apiKey, isMapReady, loadFailed, mapInstanceRef } = input;

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || !window.google?.maps) {
      return;
    }

    renderOverlays({
      map,
      items: input.itineraryItems,
      unscheduledPlaces: input.unscheduledPlaces,
      mobileSheetState: input.mobileSheetState,
      routeSegments: input.routeSegments,
      routeGeometries: input.routeGeometries,
      itemColors: input.itemColors,
      markerLabels: input.markerLabels,
      markerRecords: markerRecordsRef.current,
      polylines: polylinesRef.current,
      boundsSignatureRef,
      infoWindowRef,
      onSelectPlace: input.onSelectPlace,
      onSelectSegment: input.onSelectSegment,
    });
    updateOverlaySelection(
      markerRecordsRef.current,
      polylinesRef.current,
      input.activePlaceId,
      input.activeCanonicalPlaceId,
      input.activeSegmentId,
      input.activeDate,
    );
    updateMarkerSizes(markerRecordsRef.current, map.getZoom?.());
  }, [
    apiKey,
    input.itineraryItemsSignature,
    isMapReady,
    loadFailed,
    input.unscheduledPlacesSignature,
    input.routeSegmentsSignature,
    input.routeGeometries,
    input.itemColors,
    input.markerLabels,
    input.onSelectPlace,
    input.onSelectSegment,
    input.activeDate,
    input.activeCanonicalPlaceId,
    input.activePlaceId,
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
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || !window.google?.maps) {
      return;
    }

    renderCurrentLocationMarker({
      map,
      position: input.currentLocationPosition,
      markerRecordRef: currentLocationMarkerRef,
    });
  }, [apiKey, isMapReady, loadFailed, input.currentLocationPosition]);

  useEffect(() => {
    return () => {
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.marker.map = null;
        currentLocationMarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateOverlaySelection(
      markerRecordsRef.current,
      polylinesRef.current,
      input.activePlaceId,
      input.activeCanonicalPlaceId,
      input.activeSegmentId,
      input.activeDate,
    );
  }, [
    input.activePlaceId,
    input.activeCanonicalPlaceId,
    input.activeSegmentId,
    input.activeDate,
  ]);
}
