import { useEffect, useRef, useState } from "react";

import { buildGoogleMapsPlaceIdUrl } from "@/lib/maps-url";

import type { PlaceSearchSelection } from "../AddPlaceSearchStep";
import { poiAddChipContent } from "./map-marker-dom";
import { observePoiInfoWindowClose } from "./poi-info-window-dom";

// Above the active place marker (1000) and the current-location marker (900).
const POI_CHIP_Z_INDEX = 1100;

export type ActivePoi = {
  placeId: string;
  latitude: number;
  longitude: number;
};

type PoiClickCallbacks = {
  onPoiClick: (poi: ActivePoi) => void;
  onClear: () => void;
};

// Google delivers POI clicks as IconMouseEvent (a MapMouseEvent carrying a
// placeId). Not calling event.stop() keeps the free native info box open.
export function attachPoiClickListener(
  map: google.maps.Map,
  callbacks: PoiClickCallbacks,
): () => void {
  const listener = map.addListener?.(
    "click",
    (event: google.maps.MapMouseEvent) => {
      const placeId = (event as google.maps.IconMouseEvent).placeId ?? null;
      if (!placeId || !event.latLng) {
        callbacks.onClear();
        return;
      }

      callbacks.onPoiClick({
        placeId,
        latitude: event.latLng.lat(),
        longitude: event.latLng.lng(),
      });
    },
  );

  return () => {
    listener?.remove?.();
  };
}

// A POI click exposes only a place id and coordinates — Google renders the
// card's name inside a closed shadow root, so it cannot be read here. The
// selection therefore always leaves the name empty; the modal resolves it from
// the place id (from our own stored places when we have them, otherwise a Place
// Details lookup) and falls back to asking the user to type it.
export function buildPoiPlaceSelection(poi: ActivePoi): PlaceSearchSelection {
  return {
    google_place_id: poi.placeId,
    name: "",
    latitude: poi.latitude,
    longitude: poi.longitude,
    google_maps_url: buildGoogleMapsPlaceIdUrl(poi.placeId),
    // The same modal lookup that resolves the name resolves the photo.
    photo_name: null,
    photo_attribution: null,
    image_url: null,
    image_credit: null,
  };
}

// Anchors the "Add this place" chip at the clicked POI so it stays next to the
// native info box and tracks map panning/zooming.
export function renderPoiChipMarker(
  map: google.maps.Map,
  position: { latitude: number; longitude: number },
  onAdd: () => void,
): () => void {
  const googleMaps = window.google;
  if (!googleMaps?.maps?.marker) {
    return () => {};
  }

  const marker = new googleMaps.maps.marker.AdvancedMarkerElement({
    map,
    position: { lat: position.latitude, lng: position.longitude },
    title: "Add this place",
    content: poiAddChipContent(),
    gmpClickable: true,
    zIndex: POI_CHIP_Z_INDEX,
  });
  marker.addEventListener("gmp-click", onAdd);

  return () => {
    marker.map = null;
  };
}

export function useMapPoiPicker(input: {
  apiKey: string | undefined;
  isMapReady: boolean;
  loadFailed: boolean;
  mapInstanceRef: { current: google.maps.Map | null };
  mapContainerRef: { current: HTMLDivElement | null };
  enabled: boolean;
  onAddPlace: (selection: PlaceSearchSelection) => void;
}): void {
  const [activePoi, setActivePoi] = useState<ActivePoi | null>(null);
  const stopObserverRef = useRef<(() => void) | null>(null);
  const { apiKey, isMapReady, loadFailed, mapInstanceRef, mapContainerRef, enabled } =
    input;

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!enabled || !apiKey || loadFailed || !isMapReady || !map) {
      return;
    }

    function stopObserver() {
      stopObserverRef.current?.();
      stopObserverRef.current = null;
    }

    const removeListener = attachPoiClickListener(map, {
      onPoiClick: (poi) => {
        stopObserver();
        setActivePoi(poi);
        const container = mapContainerRef.current;
        if (!container) return;
        stopObserverRef.current = observePoiInfoWindowClose(container, () =>
          setActivePoi((current) =>
            current?.placeId === poi.placeId ? null : current,
          ),
        );
      },
      onClear: () => {
        stopObserver();
        setActivePoi(null);
      },
    });

    return () => {
      removeListener();
      stopObserver();
      setActivePoi(null);
    };
  }, [apiKey, enabled, isMapReady, loadFailed, mapContainerRef, mapInstanceRef]);

  const activePlaceId = activePoi?.placeId ?? null;
  const activeLatitude = activePoi?.latitude ?? null;
  const activeLongitude = activePoi?.longitude ?? null;

  // Keyed on the poi's fields rather than the object so an unrelated re-render
  // never tears down and rebuilds the chip marker.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (activePlaceId === null || activeLatitude === null || activeLongitude === null || !map) {
      return;
    }

    return renderPoiChipMarker(
      map,
      { latitude: activeLatitude, longitude: activeLongitude },
      () => {
        stopObserverRef.current?.();
        stopObserverRef.current = null;
        setActivePoi(null);
        input.onAddPlace(
          buildPoiPlaceSelection({
            placeId: activePlaceId,
            latitude: activeLatitude,
            longitude: activeLongitude,
          }),
        );
      },
    );
  }, [activePlaceId, activeLatitude, activeLongitude, mapInstanceRef]);
}
