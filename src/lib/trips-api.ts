import type { TripSummary } from "./types";

export type TripMetadataPayload = {
  name: string;
  destination: string;
  destination_slug: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_country_codes: string[] | null;
  // Only meaningful on create: the already-fetched cover image (data URL) and
  // its attribution, stored as the trip's cover photo.
  destination_photo_data?: string | null;
  destination_photo_attribution?: string | null;
  start_date: string | null;
  end_date: string | null;
};

export async function loadTrips(): Promise<TripSummary[]> {
  const response = await fetch("/api/trips");
  const data = await readJsonResponse(response, "Failed to load trips.");

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to load trips.",
    );
  }

  return Array.isArray(data.trips) ? data.trips : [];
}

export async function createTrip(
  payload: TripMetadataPayload,
): Promise<TripSummary> {
  const data = await tripJsonRequest("/api/trips", "POST", payload);
  return data.trip as TripSummary;
}

export async function updateTrip(
  tripId: number,
  payload: TripMetadataPayload,
): Promise<TripSummary> {
  const data = await tripJsonRequest(`/api/trips/${tripId}`, "PATCH", payload);
  return data.trip as TripSummary;
}

export async function deleteTrip(tripId: number): Promise<void> {
  const response = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
  const data = await readJsonResponse(response, "Failed to delete trip.");

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to delete trip.",
    );
  }
}

async function tripJsonRequest(
  path: string,
  method: "PATCH" | "POST",
  payload: TripMetadataPayload,
): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJsonResponse(response, "Failed to save trip.");

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to save trip.",
    );
  }

  return data;
}

async function readJsonResponse(
  response: Response,
  fallbackError: string,
): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) {
      return { error: fallbackError };
    }
    throw new Error(fallbackError);
  }
}
