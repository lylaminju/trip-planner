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
  isValidPlacePhotoName,
} from "@/server/google-places-search-service";

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
  if (!isValidPlacePhotoName(photoName)) {
    return jsonError("A valid place photo reference is required.", 400);
  }

  try {
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
