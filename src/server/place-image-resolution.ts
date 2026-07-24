import { storePlacePhoto } from "./destination-photo-service";
import { getSupabaseClient } from "./supabase";

export type PlaceImage = {
  image_url: string | null;
  image_credit: string | null;
};

// What we already know about a place id without asking Google. The name makes
// a repeat map-POI pick of an already-saved place cost nothing: it answers the
// same question as the billed Place Details Pro lookup.
export type ReusablePlace = PlaceImage & {
  name: string | null;
};

// A saved place's reusable columns. `google_place_name` is Google's canonical
// name, never the user's editable `name`.
type SavedPlaceRow = PlaceImage & {
  google_place_name: string | null;
};

const NO_IMAGE: PlaceImage = { image_url: null, image_credit: null };
export const NO_REUSABLE_PLACE: ReusablePlace = { ...NO_IMAGE, name: null };

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
    const reused = await findReusablePlace(input.placeId);
    // Only the image belongs in a place's stored columns; the name comes from
    // the caller's own payload, not from whatever we matched on the place id.
    return { image_url: reused.image_url, image_credit: reused.image_credit };
  }

  return NO_IMAGE;
}

/**
 * Finds what we already hold for a Google place id, so a photo that was fetched
 * (and billed) once is never fetched from Google again and a name we already
 * stored never costs a Place Details lookup: first a saved place, then a
 * curated candidate. Both lookups fail soft to nothing.
 */
export async function findReusablePlace(
  placeId: string,
): Promise<ReusablePlace> {
  // `google_place_name` holds Google's canonical name and nothing else, so it
  // is safe to serve to whoever picks this place id next. `places.name` must
  // never be read here: it is user-authored, and this lookup has no trip or
  // account scope, so it would leak one person's private label for the place to
  // everyone else. Ordered so repeated matches resolve to the same row rather
  // than an arbitrary one.
  const saved = await readFirstRow<SavedPlaceRow>(() =>
    getSupabaseClient()
      .from("places")
      .select("google_place_name, image_url, image_credit")
      .eq("google_place_id", placeId)
      .not("image_url", "is", null)
      .order("id", { ascending: true })
      .limit(1),
  );
  if (saved?.image_url) {
    return {
      name: saved.google_place_name,
      image_url: saved.image_url,
      image_credit: saved.image_credit,
    };
  }

  // Curated candidate rows are seeded content rather than user text, so their
  // name is safe to share and saves a billed Place Details lookup.
  const candidate = await readFirstRow<ReusablePlace>(() =>
    getSupabaseClient()
      .from("ai_destination_candidates")
      .select("name, image_url, image_credit")
      .eq("google_place_id", placeId)
      .not("image_url", "is", null)
      .limit(1),
  );
  if (!candidate?.image_url) {
    return NO_REUSABLE_PLACE;
  }

  return {
    name: candidate.name,
    image_url: candidate.image_url,
    image_credit: candidate.image_credit,
  };
}

// Fails soft to null so a lookup error never blocks adding a place; callers
// treat a missing row and a failed query the same way.
async function readFirstRow<T>(
  runQuery: () => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T | null> {
  try {
    const { data, error } = await runQuery();
    if (error || !data?.length) {
      return null;
    }
    return data[0] as T;
  } catch {
    return null;
  }
}
