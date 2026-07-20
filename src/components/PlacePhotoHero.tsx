"use client";

import { MapPinIcon } from "./Icons";

type Props = {
  imageUrl: string | null;
  isLoading: boolean;
};

// Hero image at the top of the place details step. Keeps a stable height across
// loading/loaded/no-photo states so the form below never shifts.
export function PlacePhotoHero({ imageUrl, isLoading }: Props) {
  return (
    <div
      className={
        isLoading && !imageUrl
          ? "place-photo-hero place-photo-hero--loading"
          : "place-photo-hero"
      }
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL or Supabase Storage image; no next/image domain config needed
        <img className="place-photo-hero-img" src={imageUrl} alt="" />
      ) : (
        !isLoading && (
          <span className="place-photo-hero-fallback" aria-hidden="true">
            <MapPinIcon />
          </span>
        )
      )}
    </div>
  );
}
