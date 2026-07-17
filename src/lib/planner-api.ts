import type {
  AiPlanningGenerationInput,
  AiPlanningPreferenceInput,
  AiPlanningPreferences,
  AiPlanningSetup,
  PlannerSnapshot,
  RouteGeometry,
  TravelMode,
  TripPlannerInitialData,
} from "./types";

export type AiItineraryGenerationResult = {
  generationId: number;
  plannerSnapshot: PlannerSnapshot;
};

export type ResolvedPlace = {
  google_maps_url: string;
  name: string | null;
  latitude: number;
  longitude: number;
};

export async function resolvePlaceRequest(
  tripId: number,
  googleMapsUrl: string,
): Promise<ResolvedPlace> {
  const response = await fetch(`${tripApiBase(tripId)}/places/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ google_maps_url: googleMapsUrl }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to resolve link.",
    );
  }

  return data;
}

export async function loadTripPlannerInitialData(
  tripId: number,
): Promise<TripPlannerInitialData> {
  const response = await fetch(`${tripApiBase(tripId)}/planner`);
  if (!response.ok) {
    throw new Error("Failed to load places.");
  }

  return response.json();
}

export async function loadAiPlanningSetup(
  tripId: number,
): Promise<AiPlanningSetup> {
  const response = await fetch(`${tripApiBase(tripId)}/ai-planning/setup`);
  if (!response.ok) {
    throw new Error("Failed to load AI planning setup.");
  }

  return response.json();
}

export async function saveAiPlanningPreferences(
  tripId: number,
  payload: AiPlanningPreferenceInput,
): Promise<AiPlanningPreferences> {
  const response = await fetch(`${tripApiBase(tripId)}/ai-planning/preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Failed to save AI planning preferences.",
    );
  }

  return data;
}

export async function generateAiItinerary(
  tripId: number,
  payload: AiPlanningGenerationInput,
): Promise<AiItineraryGenerationResult> {
  const response = await fetch(`${tripApiBase(tripId)}/ai-planning/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Failed to generate AI itinerary.",
    );
  }

  return data;
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

export function deleteAllItineraryItemsRequest(
  tripId: number,
): Promise<PlannerSnapshot> {
  return plannerSnapshotRequest(`${tripApiBase(tripId)}/itinerary-items`, {
    method: "DELETE",
    fallbackError: "Failed to delete itinerary items.",
  });
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
