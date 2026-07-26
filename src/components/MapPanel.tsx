"use client";

import { useEffect, useMemo, useRef } from "react";

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
import { focusMapOnPositions } from "./map-panel/map-focus";
import { MapPanelChrome } from "./map-panel/MapPanelChrome";
import { buildItemColors } from "./map-panel/map-overlays";
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
import { useGoogleMapInstance } from "./map-panel/useGoogleMapInstance";
import { useMapOverlays } from "./map-panel/useMapOverlays";
import { useMapPoiPicker } from "./map-panel/useMapPoiPicker";
import type { PlaceSearchSelection } from "./AddPlaceSearchStep";

const DATE_FOCUS_BOUNDS_PADDING = 48;
const SEGMENT_FOCUS_BOUNDS_PADDING = 64;

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
  onAddPlaceFromMap: (selection: PlaceSearchSelection) => void;
  onPlanWithAi?: () => void;
  aiPlanNeedsDates?: boolean;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
  onEditItem: (item: ItineraryItem) => void;
  onEditPlace: (place: Place) => void;
  onClearSelection: () => void;
};

export function MapPanel(props: Props) {
  const focusedDestinationRef = useRef<string | null>(null);
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

  const { mapRef, mapInstanceRef, isMapReady, loadFailed } =
    useGoogleMapInstance({
      apiKey,
      itineraryItems,
      unscheduledPlaces: props.itinerary.unscheduled,
      itineraryItemsSignature,
      unscheduledPlacesSignature,
    });

  useMapPoiPicker({
    apiKey,
    isMapReady,
    loadFailed,
    mapInstanceRef,
    mapContainerRef: mapRef,
    enabled: props.canEdit,
    onAddPlace: props.onAddPlaceFromMap,
  });

  useMapOverlays({
    apiKey,
    isMapReady,
    loadFailed,
    mapInstanceRef,
    itineraryItems,
    itineraryItemsSignature,
    unscheduledPlaces: props.itinerary.unscheduled,
    unscheduledPlacesSignature,
    routeSegments: props.routeSegments,
    routeSegmentsSignature,
    routeGeometries: props.routeGeometries,
    itemColors,
    markerLabels,
    mobileSheetState: props.mobileSheetState,
    currentLocationPosition: props.currentLocationPosition,
    activePlaceId: props.activePlaceId,
    activeCanonicalPlaceId: props.activeCanonicalPlaceId,
    activeSegmentId: props.activeSegmentId,
    activeDate: props.activeDate,
    onSelectPlace: props.onSelectPlace,
    onSelectSegment: props.onSelectSegment,
  });

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
      focusMapOnPositions(map, [position], props.mobileSheetState);
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
    return focusMapOnPositions(
      map,
      positions,
      props.mobileSheetState,
      DATE_FOCUS_BOUNDS_PADDING,
    );
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

    return focusMapOnPositions(
      map,
      positions,
      props.mobileSheetState,
      SEGMENT_FOCUS_BOUNDS_PADDING,
    );
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
        aiPlanNeedsDates={props.aiPlanNeedsDates}
      />
    </section>
  );
}
