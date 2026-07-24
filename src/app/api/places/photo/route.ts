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
  getPlaceNameAndPhoto,
  isValidPlacePhotoName,
} from "@/server/google-places-search-service";
import {
  findReusablePlace,
  NO_REUSABLE_PLACE,
} from "@/server/place-image-resolution";

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
    // Whatever we already hold for this place id, so the billed Place Photo
    // call happens at most once per place ever.
    const reused = placeId
      ? await findReusablePlace(placeId)
      : NO_REUSABLE_PLACE;

    // No photo reference means a map POI pick, which arrives with no name.
    // Google's POI card is a closed shadow root, so the name is unreadable from
    // the DOM and only Place Details Pro has it. A stored image still spares
    // the Place Photo call on top.
    if (placeId && !photoName) {
      if (reused.name) {
        return withRefreshedSession(
          NextResponse.json(reused),
          auth.refreshedSession,
        );
      }

      const place = await getPlaceNameAndPhoto(auth.user.id, placeId, {
        skipPhoto: Boolean(reused.image_url),
      });

      return withRefreshedSession(
        NextResponse.json({
          ...place,
          image_url: reused.image_url,
          image_credit: reused.image_credit,
        }),
        auth.refreshedSession,
      );
    }

    // Everything below already knows its name, so only the image is in question.
    if (reused.image_url) {
      return withRefreshedSession(
        NextResponse.json(reused),
        auth.refreshedSession,
      );
    }

    const dataUrl = await getDestinationPhoto(auth.user.id, photoName);

    return withRefreshedSession(
      NextResponse.json({ data_url: dataUrl }),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) return response;
    throw error;
  }
}
