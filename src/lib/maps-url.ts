import type { TravelMode } from "./types";

type Coordinate = {
  latitude: number;
  longitude: number;
};

// Documented lookup URL for a place by its Google place id, used when Place
// Details returns no googleMapsUri.
export function buildGoogleMapsPlaceIdUrl(placeId: string): string {
  const params = new URLSearchParams({ q: `place_id:${placeId}` });
  return `https://www.google.com/maps/place/?${params.toString()}`;
}

// Builds a Google Maps place URL that our own resolver (`parseGoogleMapsUrl`)
// reads back into a name and coordinates. A live search pick only yields a
// place id, but the AI planning lodging/transit fields carry a Google Maps URL
// that is re-resolved server-side, so we bake the already-resolved name and
// coordinates into the canonical `/maps/place/<name>/@lat,lng` form the
// resolver understands instead of a place-id link it cannot parse.
export function buildResolvableGoogleMapsPlaceUrl(input: {
  name: string;
  latitude: number;
  longitude: number;
}): string {
  const name = encodeURIComponent(input.name.trim() || "Selected place");
  return `https://www.google.com/maps/place/${name}/@${input.latitude},${input.longitude},15z`;
}

// Documented Maps URLs search link for a coordinate, used for curated
// candidates that have no stored Google place id.
export function buildGoogleMapsSearchUrl(coordinate: Coordinate): string {
  const params = new URLSearchParams({
    api: "1",
    query: `${coordinate.latitude},${coordinate.longitude}`,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsDirectionsUrl(input: {
  origin: Coordinate;
  destination: Coordinate;
  mode: TravelMode;
}): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${input.origin.latitude},${input.origin.longitude}`,
    destination: `${input.destination.latitude},${input.destination.longitude}`,
    travelmode: input.mode,
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
