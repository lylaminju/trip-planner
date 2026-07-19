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
