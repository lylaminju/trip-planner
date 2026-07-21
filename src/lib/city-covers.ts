import { findDestinationOption } from "./destination-options";

export const DEFAULT_TRIP_COVER_IMAGE = "/default-trip-cover.jpg";

export function getTripCoverImage(input: {
  destination: string | null;
  destinationSlug: string | null;
  photoUrl?: string | null;
}): string {
  if (input.photoUrl) {
    return input.photoUrl;
  }
  return (
    findDestinationOption(input.destinationSlug)?.imagePath ??
    DEFAULT_TRIP_COVER_IMAGE
  );
}
