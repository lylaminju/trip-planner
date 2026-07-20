"use client";

import { MapPinIcon } from "./Icons";

type Props = {
  imageUrl: string | null;
  isLoading: boolean;
};

// Hero image at the top of the place details step. The box holds a fixed aspect
// ratio and the photo fills it via object-fit, so the loading, loaded, and
// no-photo states all occupy the same space and the form below never shifts
// when the fetched photo arrives.
export function PlacePhotoHero({ imageUrl, isLoading }: Props) {
  return (
    <div className="place-photo-hero">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL or Supabase Storage image; no next/image domain config needed
        <img className="place-photo-hero-img" src={imageUrl} alt="" />
      ) : isLoading ? (
        <span className="place-photo-hero-status" role="status">
          <span className="place-photo-hero-spinner" aria-hidden="true" />
          Loading photo…
        </span>
      ) : (
        <span className="place-photo-hero-fallback" aria-hidden="true">
          <MapPinIcon />
        </span>
      )}
    </div>
  );
}
