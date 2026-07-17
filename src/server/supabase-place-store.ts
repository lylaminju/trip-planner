import type {
  ItineraryItem,
  Place,
  RouteSegment,
  TravelMode,
} from "@/lib/types";
import type {
  ScheduledVisit,
  VisitDateChange,
} from "@/lib/trip-date-shift";
import {
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";
import type {
  ItineraryItemInsert,
  ItineraryItemUpdate,
  PlaceInsert,
  PlaceUpdate,
} from "@/server/place-inputs";
import { getSupabaseClient } from "@/server/supabase";

type SupabaseItineraryItemRow = Omit<ItineraryItem, "place"> & {
  place: Place | Place[] | null;
};

const PLACE_COLUMNS =
  "id, trip_id, name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url, latitude, longitude, notes, links, image_url, image_credit, created_at, updated_at";
const ITINERARY_ITEM_COLUMNS = `id, trip_id, place_id, visit_date, visit_time, notes, created_at, updated_at, place:places (${PLACE_COLUMNS})`;
const ROUTE_SEGMENT_COLUMNS =
  "id, trip_id, from_item_id, to_item_id, mode, created_at, updated_at";
const PLACE_UPDATE_COLUMNS = [
  "name",
  "address",
  "google_maps_url",
  "place_id",
  "google_place_token",
  "google_internal_ids",
  "source_list_url",
  "latitude",
  "longitude",
  "notes",
  "links",
] as const satisfies readonly (keyof PlaceUpdate)[];
const ITEM_UPDATE_COLUMNS = [
  "visit_date",
  "visit_time",
  "notes",
] as const satisfies readonly (keyof ItineraryItemUpdate)[];

export async function getPlaceById(
  tripId: number,
  id: number,
): Promise<Place> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new PlaceNotFoundError(id);
  return data as Place;
}

export async function listPlaces(tripId: number): Promise<Place[]> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("trip_id", tripId)
    .order("name", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as Place[];
}

export async function listItineraryItems(
  tripId: number,
): Promise<ItineraryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .eq("trip_id", tripId)
    .order("visit_date", { ascending: true, nullsFirst: true })
    .order("visit_time", { ascending: true, nullsFirst: true })
    .order("place_id", { ascending: true });

  if (error) throwSupabaseError(error);
  return ((data ?? []) as SupabaseItineraryItemRow[]).map(toItineraryItem);
}

export async function listItineraryItemsByPlaceId(
  tripId: number,
  placeId: number,
): Promise<ItineraryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .eq("trip_id", tripId)
    .eq("place_id", placeId)
    .order("id", { ascending: true });

  if (error) throwSupabaseError(error);
  return ((data ?? []) as SupabaseItineraryItemRow[]).map(toItineraryItem);
}

export async function listRouteSegments(
  tripId: number,
): Promise<RouteSegment[]> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select(ROUTE_SEGMENT_COLUMNS)
    .eq("trip_id", tripId)
    .order("id", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as RouteSegment[];
}

export async function insertPlace(input: PlaceInsert): Promise<Place> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .insert(input)
    .select(PLACE_COLUMNS)
    .single();

  if (error) throwSupabaseError(error);
  return data as Place;
}

export async function insertItineraryItem(
  input: ItineraryItemInsert,
): Promise<ItineraryItem> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .insert(input)
    .select(ITINERARY_ITEM_COLUMNS)
    .single();

  if (error) throwSupabaseError(error);
  return toItineraryItem(data as SupabaseItineraryItemRow);
}

export async function updatePlace(
  tripId: number,
  id: number,
  input: PlaceUpdate,
): Promise<Place> {
  const fields = PLACE_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getPlaceById(tripId, id);

  const values: Record<string, number | string | string[] | null> = {};
  for (const key of fields) {
    values[key] = input[key] ?? null;
  }
  values.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("places")
    .update(values)
    .eq("trip_id", tripId)
    .eq("id", id)
    .select(PLACE_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new PlaceNotFoundError(id);
  return data as Place;
}

export async function updateItineraryItem(
  tripId: number,
  id: number,
  input: ItineraryItemUpdate,
): Promise<ItineraryItem> {
  const fields = ITEM_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getItineraryItemById(tripId, id);

  const values: Record<string, string | null> = {};
  for (const key of fields) {
    values[key] = input[key] ?? null;
  }
  values.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .update(values)
    .eq("trip_id", tripId)
    .eq("id", id)
    .select(ITINERARY_ITEM_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new ItineraryItemNotFoundError(id);
  return toItineraryItem(data as SupabaseItineraryItemRow);
}

export async function deletePlace(tripId: number, id: number): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("places")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new PlaceNotFoundError(id);
}

export async function deleteItineraryItem(
  tripId: number,
  id: number,
): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("itinerary_items")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new ItineraryItemNotFoundError(id);
}

export async function deleteAllItineraryItems(tripId: number): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("itinerary_items")
    .delete()
    .eq("trip_id", tripId);

  if (error) throwSupabaseError(error);
}

export async function updateRouteSegmentMode(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<RouteSegment> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("id", id)
    .select(ROUTE_SEGMENT_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new RouteSegmentNotFoundError(id);
  return data as RouteSegment;
}

export async function reconcileRoutesForTrip(tripId: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc(
    "reconcile_route_segments_for_trip",
    { p_trip_id: tripId },
  );

  if (error) throwSupabaseError(error);
}

export async function listScheduledVisits(
  tripId: number,
): Promise<ScheduledVisit[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select("id, visit_date")
    .eq("trip_id", tripId)
    .not("visit_date", "is", null);

  if (error) throwSupabaseError(error);
  return (data ?? []) as ScheduledVisit[];
}

/** Groups by target date so a trip costs one update per day, not per visit. */
export async function applyVisitDateChanges(
  tripId: number,
  changes: readonly VisitDateChange[],
): Promise<void> {
  const idsByDate = new Map<string | null, number[]>();

  for (const change of changes) {
    const ids = idsByDate.get(change.visit_date) ?? [];
    ids.push(change.id);
    idsByDate.set(change.visit_date, ids);
  }

  const updatedAt = new Date().toISOString();

  for (const [visitDate, ids] of idsByDate) {
    const { error } = await getSupabaseClient()
      .from("itinerary_items")
      .update({ visit_date: visitDate, updated_at: updatedAt })
      .eq("trip_id", tripId)
      .in("id", ids);

    if (error) throwSupabaseError(error);
  }
}

async function getItineraryItemById(
  tripId: number,
  id: number,
): Promise<ItineraryItem> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .eq("trip_id", tripId)
    .eq("id", id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new ItineraryItemNotFoundError(id);
  return toItineraryItem(data as SupabaseItineraryItemRow);
}

function toItineraryItem(row: SupabaseItineraryItemRow): ItineraryItem {
  const place = Array.isArray(row.place) ? row.place[0] : row.place;
  if (!place) {
    throw new Error(
      `Supabase itinerary item ${row.id} is missing its joined place.`,
    );
  }

  return {
    id: row.id,
    trip_id: row.trip_id,
    place_id: row.place_id,
    visit_date: row.visit_date,
    visit_time: row.visit_time,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    place,
  };
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
