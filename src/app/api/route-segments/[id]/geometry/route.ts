import { NextResponse } from "next/server";

import {
  jsonError,
  mapRouteError,
  requireAuthenticatedRequest,
  withRefreshedSession,
} from "@/app/api/_utils";
import { getRouteGeometry } from "@/server/route-geometry-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await requireAuthenticatedRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const segmentId = Number(id);

  if (!Number.isInteger(segmentId)) {
    return jsonError("Invalid segment id.", 400);
  }

  try {
    return withRefreshedSession(
      NextResponse.json(await getRouteGeometry(segmentId)),
      auth.refreshedSession,
    );
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
