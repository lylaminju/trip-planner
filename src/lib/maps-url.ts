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

// Outbound Google Maps link for a saved place. The place id is the only
// identifier that opens the place itself, so it wins when we resolved one.
// Without an id, a name (plus address when we have one) search still lands on
// the place page, while a coordinate query only drops an unnamed pin at the
// raw point.
export function buildGoogleMapsPlaceLinkUrl(input: {
  name: string;
  address?: string | null;
  googlePlaceId: string | null;
}): string {
  if (input.googlePlaceId) {
    return buildGoogleMapsPlaceIdUrl(input.googlePlaceId);
  }

  const query = [input.name.trim(), input.address?.trim()]
    .filter(Boolean)
    .join(", ");
  const params = new URLSearchParams({ api: "1", query });
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
