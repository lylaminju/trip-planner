import type {
  AiDestinationTransitHub,
  TripTransitPoint,
  TripTransitPointKind,
} from "@/lib/types";

import type { AiPlannerTransitPointContext } from "./openai-ai-planner";
import {
  updateTransitPointTime,
  upsertTransitPointFromGoogleMapsUrl,
  upsertTransitPointFromHub,
} from "./supabase-ai-planning-service";

export function transitPointOfKind(
  transitPoints: TripTransitPoint[],
  kind: TripTransitPointKind,
): TripTransitPoint | null {
  return transitPoints.find((point) => point.kind === kind) ?? null;
}

export async function resolveTransitPointForGeneration(
  tripId: number,
  kind: TripTransitPointKind,
  input: {
    hub: AiDestinationTransitHub | null;
    googleMapsUrl: string | null;
    eventTime: string | null;
  },
  existing: TripTransitPoint | null,
): Promise<TripTransitPoint | null> {
  if (input.hub) {
    return upsertTransitPointFromHub(tripId, kind, input.hub, input.eventTime);
  }
  if (input.googleMapsUrl) {
    return upsertTransitPointFromGoogleMapsUrl(
      tripId,
      kind,
      input.googleMapsUrl,
      input.eventTime,
    );
  }
  if (!existing) return null;
  if (existing.event_time !== input.eventTime) {
    return updateTransitPointTime(tripId, kind, input.eventTime);
  }

  return existing;
}

export function transitPointPromptContext(
  point: TripTransitPoint | null,
): AiPlannerTransitPointContext | null {
  return point
    ? {
        name: point.name,
        latitude: point.latitude,
        longitude: point.longitude,
        time: point.event_time,
      }
    : null;
}
