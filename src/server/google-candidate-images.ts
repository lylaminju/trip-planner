import {
  PLACES_PER_USER_DAILY_LIMIT,
  PLACES_PHOTO_MONTHLY_LIMIT,
} from "@/lib/api-limits";
import type { AiDestinationCandidate } from "@/lib/types";

import {
  fetchPlacePhoto,
  fetchPlacePhotoReference,
  requirePlacesApiKey,
  searchPlaceId,
} from "./google-places";
import type { AiCatalogDestination } from "./openai-destination-catalog";
import { getSupabaseClient } from "./supabase";
import {
  countPlacesCallsThisMonth,
  countUserPlacesCallsToday,
  PLACES_SKU,
  recordPlacesCall,
} from "./supabase-google-places-usage-store";

// Same bucket the Wikimedia backfill script writes to; Google-resolved images
// live alongside them and are served from our storage, never re-fetched.
export const CANDIDATE_IMAGES_BUCKET = "candidate-images";
// Card thumbnails render in a ~104px box; 480px covers retina displays without
// downloading cover-sized bytes. Google resizes server-side, so no local
// image processing is needed.
const CANDIDATE_IMAGE_MAX_WIDTH_PX = 480;
const CANDIDATE_IMAGE_MAX_HEIGHT_PX = 480;
const IMAGE_RESOLUTION_CONCURRENCY = 6;

/**
 * How many of the requested candidates may get a billed photo call without
 * breaching the shared monthly Photo budget or the user's daily cap. The
 * free-tier ceilings are hard guarantees, so image resolution truncates
 * rather than spills into paid usage.
 */
export function imageResolutionAllowance(input: {
  candidateCount: number;
  photoCallsThisMonth: number;
  userCallsToday: number;
}): number {
  const monthlyRemaining = Math.max(
    0,
    PLACES_PHOTO_MONTHLY_LIMIT - input.photoCallsThisMonth,
  );
  const dailyRemaining = Math.max(
    0,
    PLACES_PER_USER_DAILY_LIMIT - input.userCallsToday,
  );
  return Math.min(input.candidateCount, monthlyRemaining, dailyRemaining);
}

export function googleImageCredit(author: string | null): string {
  return author ? `${author}, via Google Maps` : "Google Maps";
}

/**
 * Resolves Google Places photos for freshly generated catalog candidates:
 * IDs-Only text search ($0) -> IDs-Only photo reference ($0) -> one billed
 * Photo media call per candidate, stored in our bucket with attribution. The
 * resolved google_place_id is persisted even when no photo exists, which also
 * powers Add-place dedup and photo reuse.
 *
 * Entirely fail-soft: a missing API key, an exhausted photo budget, or any
 * per-candidate failure leaves rows imageless instead of failing the catalog.
 */
export async function resolveCandidateImagesWithGoogle(input: {
  candidates: AiDestinationCandidate[];
  destination: AiCatalogDestination;
  userId: string;
}): Promise<void> {
  let apiKey: string;
  try {
    apiKey = requirePlacesApiKey();
  } catch {
    return;
  }

  const pending = input.candidates.filter(
    (candidate) => candidate.image_url === null,
  );
  if (pending.length === 0) return;

  const allowance = imageResolutionAllowance({
    candidateCount: pending.length,
    photoCallsThisMonth: await countPlacesCallsThisMonth(PLACES_SKU.PHOTO),
    userCallsToday: await countUserPlacesCallsToday(input.userId),
  });
  const queue = pending.slice(0, allowance);
  if (queue.length === 0) return;

  await Promise.all(
    Array.from(
      { length: Math.min(IMAGE_RESOLUTION_CONCURRENCY, queue.length) },
      async () => {
        for (
          let candidate = queue.shift();
          candidate !== undefined;
          candidate = queue.shift()
        ) {
          try {
            await resolveOneCandidateImage(
              apiKey,
              candidate,
              input.destination,
              input.userId,
            );
          } catch {
            // Fail soft per candidate; the Wikimedia backfill script remains
            // the manual recovery path for anything left imageless.
          }
        }
      },
    ),
  );
}

async function resolveOneCandidateImage(
  apiKey: string,
  candidate: AiDestinationCandidate,
  destination: AiCatalogDestination,
  userId: string,
): Promise<void> {
  const placeId = await searchPlaceId({
    apiKey,
    query: `${candidate.name}, ${destination.name}`,
    locationBias:
      destination.latitude !== null && destination.longitude !== null
        ? { latitude: destination.latitude, longitude: destination.longitude }
        : null,
  });
  if (!placeId) return;

  const patch: Record<string, unknown> = {
    google_place_id: placeId,
    updated_at: new Date().toISOString(),
  };

  const reference = await fetchPlacePhotoReference({ apiKey, placeId });
  if (reference.photo_name) {
    const photo = await fetchPlacePhoto({
      apiKey,
      photoName: reference.photo_name,
      maxWidthPx: CANDIDATE_IMAGE_MAX_WIDTH_PX,
      maxHeightPx: CANDIDATE_IMAGE_MAX_HEIGHT_PX,
    });
    await recordPlacesCall(userId, PLACES_SKU.PHOTO);

    const imageUrl = await uploadCandidateImage(candidate, photo);
    if (imageUrl) {
      patch.image_url = imageUrl;
      patch.image_credit = googleImageCredit(reference.photo_attribution);
    }
  }

  const { error } = await getSupabaseClient()
    .from("ai_destination_candidates")
    .update(patch)
    .eq("id", candidate.id);
  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }
}

async function uploadCandidateImage(
  candidate: AiDestinationCandidate,
  photo: { bytes: ArrayBuffer; contentType: string },
): Promise<string | null> {
  const extension = photo.contentType === "image/png" ? "png" : "jpg";
  const objectPath = `${storageSafeSlug(candidate.destination_slug)}/${candidate.id}.${extension}`;

  const { error } = await getSupabaseClient()
    .storage.from(CANDIDATE_IMAGES_BUCKET)
    .upload(objectPath, Buffer.from(photo.bytes), {
      contentType: photo.contentType,
      upsert: true,
    });
  if (error) return null;

  return (
    getSupabaseClient()
      .storage.from(CANDIDATE_IMAGES_BUCKET)
      .getPublicUrl(objectPath).data.publicUrl || null
  );
}

// Custom catalog keys contain commas and dots ("custom-pt-lisbon-38.7,-9.1"),
// which Supabase Storage rejects in object keys; curated slugs pass unchanged.
function storageSafeSlug(destinationSlug: string): string {
  return destinationSlug.replace(/[^a-z0-9-]+/gi, "-");
}
