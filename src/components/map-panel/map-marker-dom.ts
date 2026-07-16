import { getMarkerSizing } from "@/lib/map-marker-labels";
import type { Place } from "@/lib/types";

import type { MarkerRecord } from "./map-overlays";

export function updateMarkerSizes(
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

export function markerContent(
  color: string,
  label: string | null,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "map-marker";
  element.style.backgroundColor = color;
  if (label) {
    element.textContent = label;
  }

  return element;
}

export function currentLocationMarkerContent(): HTMLElement {
  const element = document.createElement("div");
  element.className = "current-location-marker";
  element.setAttribute("aria-label", "Current location");

  const pulse = document.createElement("span");
  pulse.className = "current-location-marker-pulse";

  const dot = document.createElement("span");
  dot.className = "current-location-marker-dot";

  element.append(pulse, dot);
  return element;
}

export function getInfoWindow(infoWindowRef: {
  current: google.maps.InfoWindow | null;
}): google.maps.InfoWindow {
  const googleMaps = window.google!;

  if (!infoWindowRef.current) {
    infoWindowRef.current = new googleMaps.maps.InfoWindow();
  }

  return infoWindowRef.current;
}

export function openPlaceInfoWindow(
  map: google.maps.Map,
  marker: google.maps.marker.AdvancedMarkerElement,
  infoWindow: google.maps.InfoWindow,
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
