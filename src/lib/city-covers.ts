import { findDestinationOption } from "./destination-options";

export const DEFAULT_TRIP_COVER_IMAGE = "/sign-in-bg.jpg";

export function getTripCoverImage(input: {
  destination: string | null;
}): string {
  return (
    findDestinationOption(input.destination)?.imagePath ??
    DEFAULT_TRIP_COVER_IMAGE
  );
}
