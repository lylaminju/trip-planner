"use client";

import { useEffect, useMemo, useRef } from "react";

import type { CurrentLocationControl } from "@/hooks/useCurrentLocationControl";
import type { TripPlannerModals } from "@/hooks/useTripPlannerModals";
import type { TripPlannerSelection } from "@/hooks/useTripPlannerSelection";
import { buildTimedMarkerLabels } from "@/lib/map-marker-labels";
import type { DestinationFocus } from "@/lib/destination-options";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import {
  getSelectedDatePositions,
  getSelectedPlacePosition,
  getSelectedSegmentPositions,
} from "@/lib/map-viewport";
import type {
  ItineraryView,
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

const DATE_FOCUS_BOUNDS_PADDING = 48;
const SEGMENT_FOCUS_BOUNDS_PADDING = 64;

type MapSelectionProps = Pick<
  TripPlannerSelection,
  | "activeItemId"
  | "activeCanonicalPlaceId"
  | "activeSegmentId"
  | "activeDate"
  | "selectItem"
  | "toggleSegmentSelection"
  | "clearSelection"
>;

type MapModalsProps = Pick<
  TripPlannerModals,
  | "openAddModal"
  | "openAddModalWithSelection"
  | "openEditModal"
  | "openEditItemModal"
>;

type Props = {
  itinerary: ItineraryView;
  destinationFocus: DestinationFocus | null;
  routeSegments: RouteSegment[];
  selection: MapSelectionProps;
  modals: MapModalsProps;
  mobileSheetState: MobileSheetState;
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
  currentLocation: CurrentLocationControl;
  canShowCurrentLocation: boolean;
  hidden?: boolean;
  canEdit: boolean;
  onPlanWithAi?: () => void;
  aiPlanMutedHint?: string | null;
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
        props.selection.activeItemId,
        props.selection.activeCanonicalPlaceId,
      ),
    [
      props.itinerary,
      props.selection.activeItemId,
      props.selection.activeCanonicalPlaceId,
    ],
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
    onAddPlace: props.modals.openAddModalWithSelection,
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
    currentLocationPosition: props.currentLocation.currentLocationPosition,
    activePlaceId: props.selection.activeItemId,
    activeCanonicalPlaceId: props.selection.activeCanonicalPlaceId,
    activeSegmentId: props.selection.activeSegmentId,
    activeDate: props.selection.activeDate,
    onSelectPlace: props.selection.selectItem,
    onSelectSegment: props.selection.toggleSegmentSelection,
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
      props.selection.activeItemId,
      props.selection.activeCanonicalPlaceId,
    );
    if (position) {
      focusMapOnPositions(map, [position], props.mobileSheetState);
    }
  }, [
    apiKey,
    isMapReady,
    itineraryItemsSignature,
    loadFailed,
    props.selection.activeCanonicalPlaceId,
    props.selection.activeItemId,
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
      props.selection.activeDate,
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
    props.selection.activeDate,
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
      props.selection.activeSegmentId,
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
    props.selection.activeSegmentId,
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
          onEditVisit={props.modals.openEditItemModal}
          onEditPlace={props.modals.openEditModal}
          onClose={props.selection.clearSelection}
        />
      )}
      <MapPanelChrome
        hasPlaces={hasPlaces}
        routeGeometryError={props.routeGeometryError}
        currentLocationToast={props.currentLocation.currentLocationToast}
        canShowCurrentLocation={props.canShowCurrentLocation}
        isCurrentLocationActive={props.currentLocation.isCurrentLocationEnabled}
        canEdit={props.canEdit}
        onToggleCurrentLocation={props.currentLocation.toggleCurrentLocation}
        onAddPlace={props.modals.openAddModal}
        onPlanWithAi={props.onPlanWithAi}
        aiPlanMutedHint={props.aiPlanMutedHint}
      />
    </section>
  );
}
