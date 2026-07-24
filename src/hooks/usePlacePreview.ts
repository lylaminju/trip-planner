"use client";

import { useEffect, useRef, useState } from "react";

import { createPlacePhotoSessionCache } from "@/lib/place-photo-session-cache";
import {
  fetchDestinationPhoto,
  fetchPlaceNameAndPhoto,
  type PlaceNameAndPhoto,
} from "@/lib/places-api";

type SelectionPhotoSource = {
  google_place_id: string | null;
  photo_name: string | null;
  photo_attribution: string | null;
  image_url: string | null;
  image_credit: string | null;
};

export type PlacePhotoPayload = {
  photo_data_url: string;
  photo_attribution: string | null;
};

export type PlacePreview = {
  // Displayable image: a candidate's stored URL, a reused stored photo, or the
  // freshly fetched data URL.
  imageUrl: string | null;
  // Name the server resolved for a selection that arrived without one (a map
  // POI pick). Null until it lands, and whenever the selection already had one.
  resolvedName: string | null;
  isLoading: boolean;
  // Awaits any in-flight fetch so a fast save still carries the photo that was
  // already fetched (and billed) for the preview. Null when nothing to send —
  // candidate and reused images are re-resolved server-side, never re-uploaded.
  getPhotoPayload: () => Promise<PlacePhotoPayload | null>;
};

// Module-level: repeated picks of the same place anywhere in the session share
// one fetch, so re-opening the modal on the same POI never re-bills Google.
const sessionCache = createPlacePhotoSessionCache<PlaceNameAndPhoto | null>();

/**
 * Resolves the photo — and, for map POI picks, the name — for a place selection
 * at most once. The image shown in the modal hero is the same one handed back
 * at save time, and the name rides along in the same request, so adding a place
 * costs at most one billed Place Photo call plus one Place Details Pro call,
 * and neither when we already have the place stored.
 */
export function usePlacePreview(
  selection: SelectionPhotoSource | null,
): PlacePreview {
  const [fetched, setFetched] = useState<PlaceNameAndPhoto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const photoPromiseRef = useRef<Promise<PlaceNameAndPhoto | null> | null>(
    null,
  );

  const placeId = selection?.google_place_id ?? null;
  const photoName = selection?.photo_name ?? null;
  const photoAttribution = selection?.photo_attribution ?? null;
  const hasStoredImage = Boolean(selection?.image_url);

  useEffect(() => {
    setFetched(null);
    photoPromiseRef.current = null;

    // Candidate selections already carry a stored image; nothing to fetch.
    if (hasStoredImage || (!photoName && !placeId)) {
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    const promise = (
      placeId
        ? sessionCache.getOrFetch(placeId, () =>
            fetchPlaceNameAndPhoto({ placeId, photoName }),
          )
        : fetchDestinationPhoto(photoName as string).then((dataUrl) => ({
            name: null,
            data_url: dataUrl,
            attribution: photoAttribution,
            image_url: null,
            image_credit: null,
          }))
    ).catch(() => null);

    photoPromiseRef.current = promise;
    promise.then((photo) => {
      if (!isCurrent) return;
      setFetched(photo);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [hasStoredImage, photoName, photoAttribution, placeId]);

  async function getPhotoPayload(): Promise<PlacePhotoPayload | null> {
    const photo = await (photoPromiseRef.current ?? Promise.resolve(null));
    return photo?.data_url
      ? {
          photo_data_url: photo.data_url,
          photo_attribution: photo.attribution ?? photoAttribution,
        }
      : null;
  }

  return {
    imageUrl:
      selection?.image_url ?? fetched?.image_url ?? fetched?.data_url ?? null,
    resolvedName: fetched?.name ?? null,
    isLoading,
    getPhotoPayload,
  };
}
