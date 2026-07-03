import type {
  PlannerSnapshot,
  RouteGeometry,
  TravelMode,
  TripPlannerInitialData,
} from "./types";

export async function loadTripPlannerInitialData(
  tripId: number,
): Promise<TripPlannerInitialData> {
  const response = await fetch(`${tripApiBase(tripId)}/planner`);
  if (!response.ok) {
    throw new Error("Failed to load places.");
  }

  return response.json();
}

export function savePlaceRequest(
  tripId: number,
  payload: Record<string, unknown>,
  id?: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    id
      ? `${tripApiBase(tripId)}/places/${id}`
      : `${tripApiBase(tripId)}/places`,
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
      fallbackError: "Failed to save place.",
    },
  );
}

export function saveItineraryItemRequest(
  tripId: number,
  payload: Record<string, unknown>,
  id: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    `${tripApiBase(tripId)}/itinerary-items/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      fallbackError: "Failed to save visit.",
    },
  );
}

export function deletePlaceRequest(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`${tripApiBase(tripId)}/places/${id}`, {
    method: "DELETE",
    fallbackError: "Failed to delete place.",
  });
}

export function schedulePlaceRequest(
  tripId: number,
  id: number,
  visitDate: string | null,
  visitTime: string | null,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    `${tripApiBase(tripId)}/places/${id}/schedule`,
    {
      method: "PATCH",
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
      fallbackError: "Failed to schedule place.",
    },
  );
}

export function createItineraryItemRequest(
  tripId: number,
  placeId: number,
  payload: Record<string, unknown>,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    `${tripApiBase(tripId)}/places/${placeId}/schedule`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      fallbackError: "Failed to add visit.",
    },
  );
}

export function scheduleItineraryItemRequest(
  tripId: number,
  id: number,
  visitDate: string | null,
  visitTime: string | null,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    `${tripApiBase(tripId)}/itinerary-items/${id}/schedule`,
    {
      method: "PATCH",
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
      fallbackError: "Failed to schedule itinerary item.",
    },
  );
}

export function deleteItineraryItemRequest(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(
    `${tripApiBase(tripId)}/itinerary-items/${id}`,
    {
      method: "DELETE",
      fallbackError: "Failed to delete itinerary item.",
    },
  );
}

export function updateSegmentModeRequest(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`${tripApiBase(tripId)}/route-segments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ mode }),
    fallbackError: "Failed to update route mode.",
  });
}

export async function fetchRouteGeometry(
  tripId: number,
  segmentId: number,
  signal?: AbortSignal,
): Promise<{ geometry: RouteGeometry | null; error: string | null }> {
  try {
    const response = await fetch(
      `${tripApiBase(tripId)}/route-segments/${segmentId}/geometry`,
      { signal },
    );
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
  } catch (error) {
    if (isAbortError(error, signal)) {
      return {
        geometry: null,
        error: null,
      };
    }

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

function tripApiBase(tripId: number): string {
  return `/api/trips/${tripId}`;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
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
