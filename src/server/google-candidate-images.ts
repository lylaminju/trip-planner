import {
  PLACES_DETAILS_MONTHLY_LIMIT,
  PLACES_PER_USER_DAILY_LIMIT,
  PLACES_PHOTO_MONTHLY_LIMIT,
} from "@/lib/api-limits";
import type { AiDestinationCandidate } from "@/lib/types";

import { resolveCandidatePlace } from "./candidate-place-resolution";
import { fetchPlacePhoto, requirePlacesApiKey } from "./google-places";
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

/**
 * The same ceiling for the Place Details Pro lookup that resolves a
 * candidate's place id and true coordinates. Budgeted separately from photos,
 * and spent first: a missing thumbnail is cosmetic, while an unresolved
 * candidate keeps the model's estimated coordinates, which drive routing,
 * lunch matching, and map pins.
 */
export function placeResolutionAllowance(input: {
  candidateCount: number;
  detailsCallsThisMonth: number;
  userCallsToday: number;
}): number {
  const monthlyRemaining = Math.max(
    0,
    PLACES_DETAILS_MONTHLY_LIMIT - input.detailsCallsThisMonth,
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
    (candidate) =>
      candidate.google_place_id === null || candidate.image_url === null,
  );
  if (pending.length === 0) return;

  const userCallsToday = await countUserPlacesCallsToday(input.userId);
  const placeAllowance = placeResolutionAllowance({
    candidateCount: pending.length,
    detailsCallsThisMonth: await countPlacesCallsThisMonth(PLACES_SKU.DETAILS),
    userCallsToday,
  });
  const queue = pending.slice(0, placeAllowance);
  if (queue.length === 0) return;

  // Photos are what is left of the day once resolution is paid for, and no
  // candidate can get one without resolving first.
  const photoBudget = {
    remaining: imageResolutionAllowance({
      candidateCount: queue.length,
      photoCallsThisMonth: await countPlacesCallsThisMonth(PLACES_SKU.PHOTO),
      userCallsToday: userCallsToday + queue.length,
    }),
  };
  // Every place already spoken for in this catalog, so a padded candidate
  // cannot claim a place another row holds. The unique index on
  // (destination_slug, google_place_id) is the backstop when concurrent
  // workers resolve the same place at once.
  const placeIdsInUse = new Set(
    input.candidates
      .map((candidate) => candidate.google_place_id)
      .filter((placeId): placeId is string => placeId !== null),
  );

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
              placeIdsInUse,
              photoBudget,
            );
          } catch {
            // Fail soft per candidate; the backfill scripts remain the manual
            // recovery path for anything left unresolved or imageless.
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
  placeIdsInUse: Set<string>,
  photoBudget: { remaining: number },
): Promise<void> {
  const resolution = await resolveCandidatePlace({
    apiKey,
    userId,
    candidate,
    destinationName: destination.name,
    destinationLocation:
      destination.latitude !== null && destination.longitude !== null
        ? { latitude: destination.latitude, longitude: destination.longitude }
        : null,
    placeIdsInUse,
  });
  // A rejected match leaves the row as generated: no place id, and the model's
  // own coordinates. Writing an unverified place would put the wrong point on
  // the map under a name that looks right.
  if (resolution === null || resolution.rejection !== null) return;

  const { place } = resolution;
  placeIdsInUse.add(place.place_id);

  const patch: Record<string, unknown> = {
    google_place_id: place.place_id,
    latitude: place.latitude,
    longitude: place.longitude,
    updated_at: new Date().toISOString(),
  };

  if (
    candidate.image_url === null &&
    place.photo_name &&
    photoBudget.remaining > 0
  ) {
    photoBudget.remaining -= 1;
    const photo = await fetchPlacePhoto({
      apiKey,
      photoName: place.photo_name,
      maxWidthPx: CANDIDATE_IMAGE_MAX_WIDTH_PX,
      maxHeightPx: CANDIDATE_IMAGE_MAX_HEIGHT_PX,
    });
    await recordPlacesCall(userId, PLACES_SKU.PHOTO);

    const imageUrl = await uploadCandidateImage(candidate, photo);
    if (imageUrl) {
      patch.image_url = imageUrl;
      patch.image_credit = googleImageCredit(place.photo_attribution);
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
