import type { TripSummary } from "./types";

export type TripMetadataPayload = {
  name: string;
  start_date: string | null;
  end_date: string | null;
  timezone: string;
};

export async function loadTrips(): Promise<TripSummary[]> {
  const response = await fetch("/api/trips");
  const data = await response.json();

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
  const data = await response.json();

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
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to save trip.",
    );
  }

  return data;
}
