import type { PlannerSnapshot, RouteGeometry, TravelMode } from "./types";

export async function loadPlannerSnapshot(): Promise<PlannerSnapshot> {
  const response = await fetch("/api/places");
  if (!response.ok) {
    throw new Error("Failed to load places.");
  }

  return response.json();
}

export function savePlaceRequest(
  payload: Record<string, unknown>,
  id?: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(id ? `/api/places/${id}` : "/api/places", {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload),
    fallbackError: "Failed to save place.",
  });
}

export function saveItineraryItemRequest(
  payload: Record<string, unknown>,
  id: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/itinerary-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    fallbackError: "Failed to save visit.",
  });
}

export function deletePlaceRequest(id: number): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/places/${id}`, {
    method: "DELETE",
    fallbackError: "Failed to delete place.",
  });
}

export function schedulePlaceRequest(
  id: number,
  visitDate: string | null,
  visitTime: string | null,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/places/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    fallbackError: "Failed to schedule place.",
  });
}

export function createItineraryItemRequest(
  placeId: number,
  payload: Record<string, unknown>,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/places/${placeId}/schedule`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    fallbackError: "Failed to add visit.",
  });
}

export function scheduleItineraryItemRequest(
  id: number,
  visitDate: string | null,
  visitTime: string | null,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/itinerary-items/${id}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    fallbackError: "Failed to schedule itinerary item.",
  });
}

export function deleteItineraryItemRequest(
  id: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/itinerary-items/${id}`, {
    method: "DELETE",
    fallbackError: "Failed to delete itinerary item.",
  });
}

export function updateSegmentModeRequest(
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`/api/route-segments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ mode }),
    fallbackError: "Failed to update route mode.",
  });
}

export async function fetchRouteGeometry(
  segmentId: number,
): Promise<{ geometry: RouteGeometry | null; error: string | null }> {
  try {
    const response = await fetch(`/api/route-segments/${segmentId}/geometry`);
    if (!response.ok) {
      return {
        geometry: null,
        error:
          response.status === 503
            ? "Real routes need a server-side Google Routes API key. Showing straight lines for now."
            : "Real routes are unavailable from Google right now. Showing straight lines for now.",
      };
    }

    const geometry = (await response.json()) as RouteGeometry;
    return {
      geometry: geometry.segment_id === segmentId ? geometry : null,
      error: null,
    };
  } catch {
    return {
      geometry: null,
      error:
        "Real routes are unavailable from Google right now. Showing straight lines for now.",
    };
  }
}

export function logoutRequest(): Promise<Response> {
  return fetch("/api/auth/logout", { method: "POST" });
}

async function plannerSnapshotRequest(
  path: string,
  options: {
    method: "DELETE" | "PATCH" | "POST";
    body?: string;
    fallbackError: string;
  },
): Promise<PlannerSnapshot> {
  const response = await fetch(path, {
    method: options.method,
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : options.fallbackError,
    );
  }

  return data;
}
