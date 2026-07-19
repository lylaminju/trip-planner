import { randomUUID } from "node:crypto";

import { getSupabaseClient } from "@/server/supabase";

export const TRIP_DESTINATION_PHOTO_BUCKET = "trip-destination-photos";

// The browser sends back the already-fetched preview image, so cap what we will
// accept and store. A cover-sized JPEG/PNG is well under this.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const DATA_URL_PATTERN =
  /^data:(image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/;

type ParsedImage = { bytes: Buffer; contentType: string; extension: string };

/**
 * Validates a client-supplied image data URL, failing closed on anything that
 * is not a small JPEG/PNG. Request-derived bytes are untrusted, so this both
 * checks the declared type and sniffs the magic bytes before we store them.
 */
export function parseImageDataUrl(dataUrl: string): ParsedImage | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return null;
  }

  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    return null;
  }
  if (!hasImageMagic(bytes, contentType)) {
    return null;
  }

  return {
    bytes,
    contentType,
    extension: contentType === "image/png" ? "png" : "jpg",
  };
}

/**
 * Stores a client-supplied cover image in our own bucket and returns its public
 * URL. Fails soft (returns null) so a malformed image or upload error never
 * blocks trip creation. No Google call happens here — the photo was already
 * fetched and billed once at preview time.
 */
export async function storeDestinationPhoto(
  userId: string,
  dataUrl: string,
): Promise<string | null> {
  const image = parseImageDataUrl(dataUrl);
  if (!image) {
    return null;
  }

  const objectPath = `${userId}/${randomUUID()}.${image.extension}`;
  const { error: uploadError } = await getSupabaseClient()
    .storage.from(TRIP_DESTINATION_PHOTO_BUCKET)
    .upload(objectPath, image.bytes, {
      contentType: image.contentType,
      upsert: false,
    });
  if (uploadError) {
    return null;
  }

  const { data } = getSupabaseClient()
    .storage.from(TRIP_DESTINATION_PHOTO_BUCKET)
    .getPublicUrl(objectPath);
  return data.publicUrl || null;
}

function hasImageMagic(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  // image/png
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}
