import { NextResponse } from "next/server";

import {
  asObject,
  jsonError,
  mapRouteError,
  readJsonBody,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import {
  getDestinationPhoto,
  getPlacePhotoForPlaceId,
  isValidPlacePhotoName,
} from "@/server/google-places-search-service";
import { findReusablePlaceImage } from "@/server/place-image-resolution";

// Place ids are opaque URL-safe tokens; anything else fails closed before it
// can drive an upstream fetch.
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  const photoName =
    typeof body.photo_name === "string" ? body.photo_name.trim() : "";
  const placeId =
    typeof body.place_id === "string" ? body.place_id.trim() : "";

  if (placeId && !PLACE_ID_PATTERN.test(placeId)) {
    return jsonError("A valid place id is required.", 400);
  }
  if (!placeId && !isValidPlacePhotoName(photoName)) {
    return jsonError("A valid place photo reference is required.", 400);
  }
  if (photoName && !isValidPlacePhotoName(photoName)) {
    return jsonError("A valid place photo reference is required.", 400);
  }

  try {
    // An image we already stored for this place is reused as-is, so the
    // billed Place Photo call happens at most once per place ever.
    if (placeId) {
      const reused = await findReusablePlaceImage(placeId);
      if (reused.image_url) {
        return withRefreshedSession(
          NextResponse.json(reused),
          auth.refreshedSession,
        );
      }
    }

    if (photoName) {
      const dataUrl = await getDestinationPhoto(auth.user.id, photoName);

      return withRefreshedSession(
        NextResponse.json({ data_url: dataUrl }),
        auth.refreshedSession,
      );
    }

    const photo = await getPlacePhotoForPlaceId(auth.user.id, placeId);

    return withRefreshedSession(
      NextResponse.json(photo),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
