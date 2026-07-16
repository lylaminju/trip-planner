import { useEffect, useRef, useState } from "react";

import type { ItineraryItem, Place } from "@/lib/types";

import { loadGoogleMaps } from "./google-maps-loader";
import { createMap } from "./map-overlays";

export function useGoogleMapInstance(input: {
  apiKey: string | undefined;
  itineraryItems: ItineraryItem[];
  unscheduledPlaces: Place[];
  itineraryItemsSignature: string;
  unscheduledPlacesSignature: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const { apiKey, itineraryItems, unscheduledPlaces } = input;

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
            unscheduledPlaces,
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
  }, [apiKey, input.itineraryItemsSignature, input.unscheduledPlacesSignature]);

  return { mapRef, mapInstanceRef, isMapReady, loadFailed };
}
