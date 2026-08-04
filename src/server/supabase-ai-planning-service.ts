import type {
  AiDestinationCandidate,
  AiDestinationTransitHub,
  AiPlanningPreferenceInput,
  AiPlanningPreferences,
  AiTransitHubType,
  TripLodging,
  TripTransitPoint,
  TripTransitPointKind,
} from "@/lib/types";

import { TripValidationError } from "./errors";
import { resolveGoogleMapsUrl } from "./google-url-resolver";
import type {
  SanitizedCatalogCandidate,
  SanitizedCatalogHub,
} from "./openai-destination-catalog";
import { getSupabaseClient } from "./supabase";
import { throwSupabaseError } from "./supabase-errors";

const AI_DESTINATION_CANDIDATE_COLUMNS =
  "id, destination_slug, name, category, tags, area, region_distance_tier, sort_order, latitude, longitude, google_place_id, typical_duration_minutes, indoor_outdoor, planning_note, blurb, image_url, image_credit, created_at, updated_at";
const TRIP_LODGING_COLUMNS =
  "id, trip_id, name, latitude, longitude, google_place_id, is_primary, created_at, updated_at";
const AI_PLANNING_PREFERENCES_COLUMNS =
  "trip_id, visits_per_day_min, visits_per_day_max, interest_tags, avoid_interest_tags, preferred_travel_modes, must_see_candidate_ids, created_at, updated_at";
const TRIP_TRANSIT_POINT_COLUMNS =
  "id, trip_id, kind, name, latitude, longitude, google_place_id, hub_type, event_time, created_at, updated_at";
const AI_TRANSIT_HUB_COLUMNS =
  "id, destination_slug, name, hub_type, iata_code, latitude, longitude, sort_order, created_at, updated_at";

const TRANSIT_POINT_FALLBACK_NAMES: Record<TripTransitPointKind, string> = {
  arrival: "Arrival stop",
  departure: "Departure stop",
};

export async function listDestinationCandidates(
  destinationSlug: string,
): Promise<AiDestinationCandidate[]> {
  const { data, error } = await getSupabaseClient()
    .from("ai_destination_candidates")
    .select(AI_DESTINATION_CANDIDATE_COLUMNS)
    .eq("destination_slug", destinationSlug)
    .order("sort_order", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as AiDestinationCandidate[];
}

const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

/**
 * Persists AI-generated attraction candidates for a destination key. When a
 * concurrent request already stored a catalog for the same key (unique index
 * on destination_slug + sort_order), the existing rows win and are returned.
 */
export async function insertDestinationCandidates(
  destinationSlug: string,
  candidates: SanitizedCatalogCandidate[],
): Promise<AiDestinationCandidate[]> {
  const { data, error } = await getSupabaseClient()
    .from("ai_destination_candidates")
    .insert(
      candidates.map((candidate) => ({
        destination_slug: destinationSlug,
        ...candidate,
      })),
    )
    .select(AI_DESTINATION_CANDIDATE_COLUMNS);

  if (error) {
    if (isUniqueViolation(error)) {
      return listDestinationCandidates(destinationSlug);
    }
    throwSupabaseError(error);
  }

  return (data ?? []) as AiDestinationCandidate[];
}

// Same concurrent-writer contract as candidates, backed by the unique index
// on (destination_slug, sort_order).
export async function insertDestinationTransitHubs(
  destinationSlug: string,
  hubs: SanitizedCatalogHub[],
): Promise<AiDestinationTransitHub[]> {
  if (hubs.length === 0) return [];

  const { data, error } = await getSupabaseClient()
    .from("ai_destination_transit_hubs")
    .insert(
      hubs.map((hub) => ({
        destination_slug: destinationSlug,
        ...hub,
      })),
    )
    .select(AI_TRANSIT_HUB_COLUMNS);

  if (error) {
    if (isUniqueViolation(error)) {
      return listDestinationTransitHubs(destinationSlug);
    }
    throwSupabaseError(error);
  }

  return (data ?? []) as AiDestinationTransitHub[];
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === POSTGRES_UNIQUE_VIOLATION_CODE;
}

export async function getPrimaryLodging(
  tripId: number,
): Promise<TripLodging | null> {
  const { data, error } = await getSupabaseClient()
    .from("trip_lodgings")
    .select(TRIP_LODGING_COLUMNS)
    .eq("trip_id", tripId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return (data ?? null) as TripLodging | null;
}

export async function upsertPrimaryLodgingFromGoogleMapsUrl(
  tripId: number,
  rawUrl: string,
): Promise<TripLodging> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  if (resolved.latitude === null || resolved.longitude === null) {
    throw new TripValidationError(
      "Lodging Google Maps URL must include coordinates.",
    );
  }

  return upsertPrimaryLodging(tripId, {
    name: resolved.name?.trim() || "Lodging",
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    google_place_id: null,
  });
}

export async function listDestinationTransitHubs(
  destinationSlug: string,
): Promise<AiDestinationTransitHub[]> {
  const { data, error } = await getSupabaseClient()
    .from("ai_destination_transit_hubs")
    .select(AI_TRANSIT_HUB_COLUMNS)
    .eq("destination_slug", destinationSlug)
    .order("sort_order", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as AiDestinationTransitHub[];
}

export async function getTransitPoints(
  tripId: number,
): Promise<TripTransitPoint[]> {
  const { data, error } = await getSupabaseClient()
    .from("trip_transit_points")
    .select(TRIP_TRANSIT_POINT_COLUMNS)
    .eq("trip_id", tripId);

  if (error) throwSupabaseError(error);
  return ((data ?? []) as TripTransitPoint[]).map(normalizeTransitPoint);
}

export async function upsertTransitPointFromGoogleMapsUrl(
  tripId: number,
  kind: TripTransitPointKind,
  rawUrl: string,
  eventTime: string | null,
): Promise<TripTransitPoint> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  if (resolved.latitude === null || resolved.longitude === null) {
    throw new TripValidationError(
      `${TRANSIT_POINT_FALLBACK_NAMES[kind]} Google Maps URL must include coordinates.`,
    );
  }

  return upsertTransitPoint(tripId, kind, {
    name: resolved.name?.trim() || TRANSIT_POINT_FALLBACK_NAMES[kind],
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    hub_type: null,
    event_time: eventTime,
  });
}

export async function upsertTransitPointFromHub(
  tripId: number,
  kind: TripTransitPointKind,
  hub: AiDestinationTransitHub,
  eventTime: string | null,
): Promise<TripTransitPoint> {
  return upsertTransitPoint(tripId, kind, {
    name: hub.name,
    latitude: hub.latitude,
    longitude: hub.longitude,
    hub_type: hub.hub_type,
    event_time: eventTime,
  });
}

async function upsertTransitPoint(
  tripId: number,
  kind: TripTransitPointKind,
  input: {
    name: string;
    latitude: number;
    longitude: number;
    hub_type: AiTransitHubType | null;
    event_time: string | null;
  },
): Promise<TripTransitPoint> {
  const values = {
    trip_id: tripId,
    kind,
    ...input,
    google_place_id: null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseClient()
    .from("trip_transit_points")
    .upsert(values, { onConflict: "trip_id,kind" })
    .select(TRIP_TRANSIT_POINT_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return normalizeTransitPoint(data as TripTransitPoint);
}

export async function updateTransitPointTime(
  tripId: number,
  kind: TripTransitPointKind,
  eventTime: string | null,
): Promise<TripTransitPoint | null> {
  const { data, error } = await getSupabaseClient()
    .from("trip_transit_points")
    .update({ event_time: eventTime, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("kind", kind)
    .select(TRIP_TRANSIT_POINT_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data ? normalizeTransitPoint(data as TripTransitPoint) : null;
}

export async function getPlanningPreferences(
  tripId: number,
): Promise<AiPlanningPreferences | null> {
  const { data, error } = await getSupabaseClient()
    .from("ai_planning_preferences")
    .select(AI_PLANNING_PREFERENCES_COLUMNS)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return (data ?? null) as AiPlanningPreferences | null;
}

export async function upsertPlanningPreferences(
  tripId: number,
  input: AiPlanningPreferenceInput,
): Promise<AiPlanningPreferences> {
  const { data, error } = await getSupabaseClient()
    .from("ai_planning_preferences")
    .upsert({ trip_id: tripId, ...input }, { onConflict: "trip_id" })
    .select(AI_PLANNING_PREFERENCES_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data as AiPlanningPreferences;
}

async function upsertPrimaryLodging(
  tripId: number,
  input: {
    name: string;
    latitude: number;
    longitude: number;
    google_place_id: string | null;
  },
): Promise<TripLodging> {
  const existing = await getPrimaryLodging(tripId);
  const values = {
    trip_id: tripId,
    ...input,
    is_primary: true,
  };

  if (!existing) {
    const { data, error } = await getSupabaseClient()
      .from("trip_lodgings")
      .insert(values)
      .select(TRIP_LODGING_COLUMNS)
      .maybeSingle();

    if (error) throwSupabaseError(error);
    return data as TripLodging;
  }

  const { data, error } = await getSupabaseClient()
    .from("trip_lodgings")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("trip_id", tripId)
    .eq("id", existing.id)
    .select(TRIP_LODGING_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  return data as TripLodging;
}

function normalizeTransitPoint(point: TripTransitPoint): TripTransitPoint {
  return {
    ...point,
    // Postgres `time` columns read back as HH:MM:SS.
    event_time: point.event_time ? point.event_time.slice(0, 5) : null,
  };
}
