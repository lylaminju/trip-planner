"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildTimedMarkerLabels } from "@/lib/map-marker-labels";
import type { CurrentLocationPosition } from "@/lib/current-location";
import type { DestinationFocus } from "@/lib/destination-options";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import {
  getSelectedDatePositions,
  getSelectedPlacePosition,
  getSelectedSegmentPositions,
} from "@/lib/map-viewport";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  RouteSegment,
} from "@/lib/types";

import { CoordinateFallback } from "./map-panel/CoordinateFallback";
import { focusMapOnDestination } from "./map-panel/map-destination";
import { loadGoogleMaps } from "./map-panel/google-maps-loader";
import { MapPanelChrome } from "./map-panel/MapPanelChrome";
import {
  buildItemColors,
  createMap,
  renderCurrentLocationMarker,
  renderOverlays,
  shouldOffsetFocusForHalfSheet,
  updateOverlaySelection,
  type CurrentLocationMarkerRecord,
  type MarkerRecord,
  type PolylineRecord,
} from "./map-panel/map-overlays";
import { updateMarkerSizes } from "./map-panel/map-marker-dom";
import {
  findSelectedMapTarget,
  SelectedPlaceCard,
} from "./map-panel/SelectedPlaceCard";
import {
  buildItineraryItemsSignature,
  buildPlacesSignature,
  buildRouteSegmentsSignature,
  getItineraryItems,
} from "./map-panel/map-signatures";

type Props = {
  itinerary: ItineraryView;
  destinationFocus: DestinationFocus | null;
  routeSegments: RouteSegment[];
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  mobileSheetState: MobileSheetState;
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
  currentLocationPosition: CurrentLocationPosition | null;
  currentLocationToast: string | null;
  canShowCurrentLocation: boolean;
  isCurrentLocationActive: boolean;
  hidden?: boolean;
  canEdit: boolean;
  onToggleCurrentLocation: () => void;
  onAddPlace: () => void;
  onPlanWithAi?: () => void;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
  onEditItem: (item: ItineraryItem) => void;
  onEditPlace: (place: Place) => void;
  onClearSelection: () => void;
};

export function MapPanel(props: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRecordsRef = useRef<Map<string, MarkerRecord>>(new Map());
  const polylinesRef = useRef<Map<number, PolylineRecord>>(new Map());
  const currentLocationMarkerRef = useRef<CurrentLocationMarkerRecord | null>(
    null,
  );
  const boundsSignatureRef = useRef<string>("");
  const focusedDestinationRef = useRef<string | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
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
  const hasPlaces =
    itineraryItems.length > 0 || props.itinerary.unscheduled.length > 0;
  const selectedTarget = useMemo(
    () =>
      findSelectedMapTarget(
        props.itinerary,
        props.activePlaceId,
        props.activeCanonicalPlaceId,
      ),
    [props.itinerary, props.activePlaceId, props.activeCanonicalPlaceId],
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
    const map = mapInstanceRef.current;
    if (!apiKey || loadFailed || !isMapReady || !map || !window.google?.maps) {
      return;
    }

    renderCurrentLocationMarker({
      map,
      position: props.currentLocationPosition,
      markerRecordRef: currentLocationMarkerRef,
    });
  }, [apiKey, isMapReady, loadFailed, props.currentLocationPosition]);

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

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (
      !apiKey ||
      loadFailed ||
      !isMapReady ||
      !map ||
      !window.google?.maps ||
      props.hidden
    ) {
      return;
    }

    const positions = getSelectedDatePositions(
      itineraryItems,
      props.activeDate,
    );
    const dedupedPositions: typeof positions = [];
    const seenPositions = new Set<string>();
    positions.forEach((position) => {
      const key = `${position.lat},${position.lng}`;
      if (seenPositions.has(key)) {
        return;
      }
      seenPositions.add(key);
      dedupedPositions.push(position);
    });

    if (dedupedPositions.length === 0) {
      return;
    }

    if (dedupedPositions.length === 1) {
      map.panTo(dedupedPositions[0]);
      if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
        map.panBy(0, Math.round(window.innerHeight * 0.32));
      }
      return;
    }

    let idleListener: { remove?: () => void } | undefined;
    const bounds = new window.google.maps.LatLngBounds();
    dedupedPositions.forEach((position) => {
      bounds.extend(position);
    });
    map.fitBounds(bounds, 48);
    if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
      idleListener = window.google.maps.event?.addListenerOnce?.(
        map,
        "idle",
        () => {
          map.panBy(0, Math.round(window.innerHeight * 0.32));
        },
      );
    }

    return () => {
      idleListener?.remove?.();
    };
  }, [
    apiKey,
    isMapReady,
    itineraryItemsSignature,
    loadFailed,
    props.activeDate,
    props.hidden,
    props.mobileSheetState,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (
      !apiKey ||
      loadFailed ||
      !isMapReady ||
      !map ||
      !window.google?.maps ||
      props.hidden
    ) {
      return;
    }

    const positions = getSelectedSegmentPositions(
      itineraryItems,
      props.routeSegments,
      props.activeSegmentId,
    );
    if (positions.length !== 2) {
      return;
    }

    const [from, to] = positions;
    if (from.lat === to.lat && from.lng === to.lng) {
      map.panTo(from);
      if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
        map.panBy(0, Math.round(window.innerHeight * 0.32));
      }
      return;
    }

    let idleListener: { remove?: () => void } | undefined;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(from);
    bounds.extend(to);
    map.fitBounds(bounds, 64);
    if (shouldOffsetFocusForHalfSheet(props.mobileSheetState)) {
      idleListener = window.google.maps.event?.addListenerOnce?.(
        map,
        "idle",
        () => {
          map.panBy(0, Math.round(window.innerHeight * 0.32));
        },
      );
    }

    return () => {
      idleListener?.remove?.();
    };
  }, [
    apiKey,
    isMapReady,
    itineraryItemsSignature,
    loadFailed,
    props.activeSegmentId,
    props.hidden,
    props.mobileSheetState,
    routeSegmentsSignature,
  ]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const focus = props.destinationFocus;
    if (
      !apiKey ||
      loadFailed ||
      !isMapReady ||
      !map ||
      props.hidden ||
      hasPlaces ||
      !focus
    ) {
      return;
    }

    const signature = `${focus.latitude},${focus.longitude},${focus.zoom}`;
    if (focusedDestinationRef.current === signature) {
      return;
    }

    focusedDestinationRef.current = signature;
    focusMapOnDestination(map, focus, props.mobileSheetState);
  }, [
    apiKey,
    hasPlaces,
    isMapReady,
    loadFailed,
    props.destinationFocus,
    props.hidden,
    props.mobileSheetState,
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
      className={`panel panel-map ${
        props.canShowCurrentLocation ? "map-current-location-available" : ""
      } ${props.hidden ? "panel-map-hidden" : ""}`}
      aria-label="Google map"
      aria-hidden={props.hidden}
    >
      <div className="map-canvas" ref={mapRef} />
      {selectedTarget && !props.hidden && (
        <SelectedPlaceCard
          target={selectedTarget}
          canEdit={props.canEdit}
          onEditVisit={props.onEditItem}
          onEditPlace={props.onEditPlace}
          onClose={props.onClearSelection}
        />
      )}
      <MapPanelChrome
        hasPlaces={hasPlaces}
        routeGeometryError={props.routeGeometryError}
        currentLocationToast={props.currentLocationToast}
        canShowCurrentLocation={props.canShowCurrentLocation}
        isCurrentLocationActive={props.isCurrentLocationActive}
        canEdit={props.canEdit}
        onToggleCurrentLocation={props.onToggleCurrentLocation}
        onAddPlace={props.onAddPlace}
        onPlanWithAi={props.onPlanWithAi}
      />
    </section>
  );
}
