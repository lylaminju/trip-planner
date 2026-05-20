import { NextResponse } from "next/server";

import { asObject, jsonError, mapRouteError, readJsonBody } from "@/app/api/_utils";
import type { TravelMode } from "@/lib/types";
import { setRouteSegmentMode } from "@/server/place-service";

const MODES = new Set<TravelMode>(["walking", "transit", "bicycling", "driving"]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const segmentId = Number(id);

  if (!Number.isInteger(segmentId)) {
    return jsonError("Invalid segment id.", 400);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = asObject(parsedBody.body);
  if (!MODES.has(body.mode as TravelMode)) {
    return jsonError("Invalid travel mode.", 400);
  }

  try {
    return NextResponse.json(setRouteSegmentMode(segmentId, body.mode as TravelMode));
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
