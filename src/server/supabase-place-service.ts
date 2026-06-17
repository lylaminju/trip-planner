import type {
  ItineraryItem,
  Place,
  PlannerSnapshot,
  RouteSegment,
  TravelMode,
} from "@/lib/types";
import {
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";
import type {
  ItineraryItemInsert,
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
  PlaceInsert,
  PlaceUpdate,
} from "@/server/place-inputs";
import { getSupabaseClient } from "@/server/supabase";

type SupabaseItineraryItemRow = Omit<ItineraryItem, "place"> & {
  place: Place | Place[] | null;
};

const PLACE_COLUMNS =
  "id, trip_id, name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url, latitude, longitude, notes, links, created_at, updated_at";
const ITINERARY_ITEM_COLUMNS = `id, trip_id, place_id, visit_date, visit_time, notes, created_at, updated_at, place:places (${PLACE_COLUMNS})`;
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

export async function getPlannerSnapshot(
  tripId: number,
): Promise<PlannerSnapshot> {
  const [places, itineraryItems, routeSegments] = await Promise.all([
    listPlaces(tripId),
    listItineraryItems(tripId),
    listRouteSegments(tripId),
  ]);

  return { places, itineraryItems, routeSegments };
}

export async function getPlaceById(tripId: number, id: number): Promise<Place> {
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

export async function createPlace(
  tripId: number,
  input: PlaceCreateInput,
): Promise<PlannerSnapshot> {
  const place = await insertPlace(toPlaceInsert(tripId, input));

  if (input.visit_date !== undefined && input.visit_date !== null) {
    await insertItineraryItem(
      normalizeItineraryItemInput({
        trip_id: tripId,
        place_id: place.id,
        visit_date: input.visit_date,
        visit_time: input.visit_time ?? null,
        notes: input.itinerary_notes ?? null,
      }),
    );
  }

  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function editPlace(
  tripId: number,
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  await updatePlace(tripId, id, toPlaceUpdate(input));

  if (
    input.visit_date !== undefined ||
    input.visit_time !== undefined ||
    input.itinerary_notes !== undefined
  ) {
    const item = (await listItineraryItemsByPlaceId(tripId, id))[0];
    const currentVisitDate = item?.visit_date;
    const normalizedInput = normalizeItineraryItemUpdate(
      {
        visit_date: input.visit_date,
        visit_time: input.visit_time,
        notes: input.itinerary_notes,
      },
      currentVisitDate,
    );

    if (item) {
      if (normalizedInput.visit_date === null) {
        await deleteItineraryItem(tripId, item.id);
      } else {
        await updateItineraryItem(tripId, item.id, normalizedInput);
      }
    } else if (
      normalizedInput.visit_date !== undefined &&
      normalizedInput.visit_date !== null
    ) {
      await insertItineraryItem(
        normalizeItineraryItemInput({
          trip_id: tripId,
          place_id: id,
          visit_date: normalizedInput.visit_date ?? null,
          visit_time: normalizedInput.visit_time ?? null,
          notes: normalizedInput.notes ?? null,
        }),
      );
    }
  }

  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function removePlace(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  await deletePlace(tripId, id);
  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function schedulePlace(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  await getPlaceById(tripId, id);

  if (visit_date !== null) {
    await insertItineraryItem(
      normalizeItineraryItemInput({
        trip_id: tripId,
        place_id: id,
        visit_date,
        visit_time,
        notes,
      }),
    );
  }

  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function scheduleItineraryItem(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  const normalizedInput = normalizeItineraryItemUpdate({
    visit_date,
    visit_time,
  });

  if (visit_date === null) {
    await deleteItineraryItem(tripId, id);
  } else {
    await updateItineraryItem(tripId, id, normalizedInput);
  }

  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function editItineraryItem(
  tripId: number,
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  const currentItem = (await listItineraryItems(tripId)).find(
    (item) => item.id === id,
  );
  const normalizedInput = normalizeItineraryItemUpdate(
    input,
    currentItem?.visit_date,
  );

  if (normalizedInput.visit_date === null) {
    await deleteItineraryItem(tripId, id);
  } else {
    await updateItineraryItem(tripId, id, normalizedInput);
  }

  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function removeItineraryItem(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  await deleteItineraryItem(tripId, id);
  await reconcileRoutesForTrip(tripId);
  return getPlannerSnapshot(tripId);
}

export async function setRouteSegmentMode(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  await updateRouteSegmentMode(tripId, id, mode);
  return getPlannerSnapshot(tripId);
}

async function listPlaces(tripId: number): Promise<Place[]> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("trip_id", tripId)
    .order("name", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as Place[];
}

async function listItineraryItems(tripId: number): Promise<ItineraryItem[]> {
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

async function listItineraryItemsByPlaceId(
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

async function listRouteSegments(tripId: number): Promise<RouteSegment[]> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select(
      "id, trip_id, from_item_id, to_item_id, mode, created_at, updated_at",
    )
    .eq("trip_id", tripId)
    .order("id", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as RouteSegment[];
}

async function insertPlace(input: PlaceInsert): Promise<Place> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .insert(input)
    .select(PLACE_COLUMNS)
    .single();

  if (error) throwSupabaseError(error);
  return data as Place;
}

async function insertItineraryItem(
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

async function updatePlace(
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

async function updateItineraryItem(
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

async function deletePlace(tripId: number, id: number): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("places")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new PlaceNotFoundError(id);
}

async function deleteItineraryItem(tripId: number, id: number): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("itinerary_items")
    .delete({ count: "exact" })
    .eq("trip_id", tripId)
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new ItineraryItemNotFoundError(id);
}

async function updateRouteSegmentMode(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<RouteSegment> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("trip_id", tripId)
    .eq("id", id)
    .select(
      "id, trip_id, from_item_id, to_item_id, mode, created_at, updated_at",
    )
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new RouteSegmentNotFoundError(id);
  return data as RouteSegment;
}

async function reconcileRoutesForTrip(tripId: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc(
    "reconcile_route_segments_for_trip",
    { p_trip_id: tripId },
  );

  if (error) throwSupabaseError(error);
}

function normalizeItineraryItemInput(
  input: ItineraryItemInsert,
): ItineraryItemInsert {
  if (input.visit_date !== null) {
    return input;
  }

  return {
    ...input,
    visit_time: null,
  };
}

function normalizeItineraryItemUpdate(
  input: ItineraryItemUpdate,
  currentVisitDate: string | null | undefined = undefined,
): ItineraryItemUpdate {
  if (input.visit_date === null) {
    return {
      ...input,
      visit_time: null,
    };
  }

  if (input.visit_date === undefined && currentVisitDate === null) {
    return {
      ...input,
      visit_time: null,
    };
  }

  return input;
}

function toPlaceInsert(tripId: number, input: PlaceCreateInput): PlaceInsert {
  return {
    trip_id: tripId,
    name: input.name,
    address: input.address,
    google_maps_url: input.google_maps_url,
    place_id: input.place_id,
    google_place_token: input.google_place_token,
    google_internal_ids: input.google_internal_ids,
    source_list_url: input.source_list_url,
    latitude: input.latitude,
    longitude: input.longitude,
    notes: input.notes,
    links: input.links,
  };
}

function toPlaceUpdate(input: PlaceEditInput): PlaceUpdate {
  return {
    name: input.name,
    address: input.address,
    google_maps_url: input.google_maps_url,
    place_id: input.place_id,
    google_place_token: input.google_place_token,
    google_internal_ids: input.google_internal_ids,
    source_list_url: input.source_list_url,
    latitude: input.latitude,
    longitude: input.longitude,
    notes: input.notes,
    links: input.links,
  };
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
