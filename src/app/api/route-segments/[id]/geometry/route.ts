import { NextResponse } from "next/server";

import { jsonError, mapRouteError } from "@/app/api/_utils";
import { getRouteGeometry } from "@/server/route-geometry-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const segmentId = Number(id);

  if (!Number.isInteger(segmentId)) {
    return jsonError("Invalid segment id.", 400);
  }

  try {
    return NextResponse.json(await getRouteGeometry(segmentId));
  } catch (error) {
    const response = mapRouteError(error);
    if (response) {
      return response;
    }

    throw error;
  }
}
