import { storePlacePhoto } from "./destination-photo-service";
import { getSupabaseClient } from "./supabase";

export type PlaceImage = {
  image_url: string | null;
  image_credit: string | null;
};

const NO_IMAGE: PlaceImage = { image_url: null, image_credit: null };

/**
 * Resolves the stored image for a newly created place. A client-supplied data
 * URL (the photo already fetched and billed once at preview time) wins and is
 * uploaded to our bucket; otherwise an already-stored image for the same
 * Google place id is reused. Fails soft to no image so a malformed photo or
 * lookup error never blocks adding the place.
 */
export async function resolvePlaceImage(input: {
  userId: string;
  photoDataUrl: string | null;
  photoAttribution: string | null;
  placeId: string | null;
}): Promise<PlaceImage> {
  if (input.photoDataUrl) {
    const imageUrl = await storePlacePhoto(input.userId, input.photoDataUrl);
    if (imageUrl) {
      return { image_url: imageUrl, image_credit: input.photoAttribution };
    }
    return NO_IMAGE;
  }

  if (input.placeId) {
    return findReusablePlaceImage(input.placeId);
  }

  return NO_IMAGE;
}

/**
 * Finds an image we already have for a Google place id, so a photo that was
 * fetched (and billed) once is never fetched from Google again: first a saved
 * place's stored photo, then a curated candidate's image. Both lookups fail
 * soft to no image.
 */
export async function findReusablePlaceImage(
  placeId: string,
): Promise<PlaceImage> {
  const saved = await findImageByPlaceId("places", "place_id", placeId);
  if (saved.image_url) {
    return saved;
  }
  return findImageByPlaceId(
    "ai_destination_candidates",
    "google_place_id",
    placeId,
  );
}

async function findImageByPlaceId(
  table: string,
  placeIdColumn: string,
  placeId: string,
): Promise<PlaceImage> {
  try {
    const { data, error } = await getSupabaseClient()
      .from(table)
      .select("image_url, image_credit")
      .eq(placeIdColumn, placeId)
      .not("image_url", "is", null)
      .limit(1);

    if (error || !data?.length) {
      return NO_IMAGE;
    }

    const row = data[0] as PlaceImage;
    return { image_url: row.image_url, image_credit: row.image_credit };
  } catch {
    return NO_IMAGE;
  }
}
