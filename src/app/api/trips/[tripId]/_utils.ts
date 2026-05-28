import type { NextResponse } from "next/server";

import { jsonError, readTripId } from "@/app/api/_utils";

export type TripParams = { params: Promise<{ tripId: string }> };
export type TripEntityParams = {
  params: Promise<{ tripId: string; id: string }>;
};

export async function readTripIdParam(
  params: TripParams["params"] | TripEntityParams["params"],
): Promise<number | NextResponse> {
  return readTripId(params);
}

export async function readEntityParams(
  params: TripEntityParams["params"],
  label: string,
): Promise<{ tripId: number; id: number } | NextResponse> {
  const tripId = await readTripId(params);
  if (tripId instanceof Response) {
    return tripId;
  }

  const { id } = await params;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId)) {
    return jsonError(`Invalid ${label} id.`, 400);
  }

  return { tripId, id: parsedId };
}
