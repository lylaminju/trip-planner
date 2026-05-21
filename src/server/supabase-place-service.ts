import { reconcileRouteSegments } from "@/lib/route-reconciliation";
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

type RouteSegmentInsert = {
  from_item_id: number;
  to_item_id: number;
  mode: TravelMode;
};

const PLACE_COLUMNS =
  "id, name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url, latitude, longitude, notes, created_at, updated_at";
const ITINERARY_ITEM_COLUMNS = `id, place_id, visit_date, visit_time, notes, created_at, updated_at, place:places (${PLACE_COLUMNS})`;
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
] as const satisfies readonly (keyof PlaceUpdate)[];
const ITEM_UPDATE_COLUMNS = [
  "visit_date",
  "visit_time",
  "notes",
] as const satisfies readonly (keyof ItineraryItemUpdate)[];

export async function getPlannerSnapshot(): Promise<PlannerSnapshot> {
  const [places, itineraryItems, routeSegments] = await Promise.all([
    listPlaces(),
    listItineraryItems(),
    listRouteSegments(),
  ]);

  return { places, itineraryItems, routeSegments };
}

export async function getPlaceById(id: number): Promise<Place> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .select(PLACE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new PlaceNotFoundError(id);
  return data as Place;
}

export async function createPlace(
  input: PlaceCreateInput,
): Promise<PlannerSnapshot> {
  const place = await insertPlace(toPlaceInsert(input));

  if (input.visit_date !== undefined && input.visit_date !== null) {
    await insertItineraryItem(
      normalizeItineraryItemInput({
        place_id: place.id,
        visit_date: input.visit_date,
        visit_time: input.visit_time ?? null,
        notes: input.itinerary_notes ?? null,
      }),
    );
  }

  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function editPlace(
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  await updatePlace(id, toPlaceUpdate(input));

  if (
    input.visit_date !== undefined ||
    input.visit_time !== undefined ||
    input.itinerary_notes !== undefined
  ) {
    const item = (await listItineraryItemsByPlaceId(id))[0];
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
        await deleteItineraryItem(item.id);
      } else {
        await updateItineraryItem(item.id, normalizedInput);
      }
    } else if (
      normalizedInput.visit_date !== undefined &&
      normalizedInput.visit_date !== null
    ) {
      await insertItineraryItem(
        normalizeItineraryItemInput({
          place_id: id,
          visit_date: normalizedInput.visit_date ?? null,
          visit_time: normalizedInput.visit_time ?? null,
          notes: normalizedInput.notes ?? null,
        }),
      );
    }
  }

  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function removePlace(id: number): Promise<PlannerSnapshot> {
  await deletePlace(id);
  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function schedulePlace(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  await getPlaceById(id);

  if (visit_date !== null) {
    await insertItineraryItem(
      normalizeItineraryItemInput({
        place_id: id,
        visit_date,
        visit_time,
        notes,
      }),
    );
  }

  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function scheduleItineraryItem(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  const normalizedInput = normalizeItineraryItemUpdate({
    visit_date,
    visit_time,
  });

  if (visit_date === null) {
    await deleteItineraryItem(id);
  } else {
    await updateItineraryItem(id, normalizedInput);
  }

  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function editItineraryItem(
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  const currentItem = (await listItineraryItems()).find(
    (item) => item.id === id,
  );
  const normalizedInput = normalizeItineraryItemUpdate(
    input,
    currentItem?.visit_date,
  );

  if (normalizedInput.visit_date === null) {
    await deleteItineraryItem(id);
  } else {
    await updateItineraryItem(id, normalizedInput);
  }

  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function removeItineraryItem(
  id: number,
): Promise<PlannerSnapshot> {
  await deleteItineraryItem(id);
  await reconcileAllRoutes();
  return getPlannerSnapshot();
}

export async function setRouteSegmentMode(
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  await updateRouteSegmentMode(id, mode);
  return getPlannerSnapshot();
}

async function listPlaces(): Promise<Place[]> {
  const { data, error } = await getSupabaseClient()
    .from("places")
    .select(PLACE_COLUMNS)
    .order("name", { ascending: true });

  if (error) throwSupabaseError(error);
  return (data ?? []) as Place[];
}

async function listItineraryItems(): Promise<ItineraryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .order("visit_date", { ascending: true, nullsFirst: true })
    .order("visit_time", { ascending: true, nullsFirst: true })
    .order("place_id", { ascending: true });

  if (error) throwSupabaseError(error);
  return ((data ?? []) as SupabaseItineraryItemRow[]).map(toItineraryItem);
}

async function listItineraryItemsByPlaceId(
  placeId: number,
): Promise<ItineraryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .eq("place_id", placeId)
    .order("id", { ascending: true });

  if (error) throwSupabaseError(error);
  return ((data ?? []) as SupabaseItineraryItemRow[]).map(toItineraryItem);
}

async function listRouteSegments(): Promise<RouteSegment[]> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .select("id, from_item_id, to_item_id, mode, created_at, updated_at")
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

async function updatePlace(id: number, input: PlaceUpdate): Promise<Place> {
  const fields = PLACE_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getPlaceById(id);

  const values: Record<string, number | string | null> = {};
  for (const key of fields) {
    values[key] = input[key] ?? null;
  }
  values.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("places")
    .update(values)
    .eq("id", id)
    .select(PLACE_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new PlaceNotFoundError(id);
  return data as Place;
}

async function updateItineraryItem(
  id: number,
  input: ItineraryItemUpdate,
): Promise<ItineraryItem> {
  const fields = ITEM_UPDATE_COLUMNS.filter((key) => input[key] !== undefined);
  if (fields.length === 0) return getItineraryItemById(id);

  const values: Record<string, string | null> = {};
  for (const key of fields) {
    values[key] = input[key] ?? null;
  }
  values.updated_at = new Date().toISOString();

  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .update(values)
    .eq("id", id)
    .select(ITINERARY_ITEM_COLUMNS)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new ItineraryItemNotFoundError(id);
  return toItineraryItem(data as SupabaseItineraryItemRow);
}

async function getItineraryItemById(id: number): Promise<ItineraryItem> {
  const { data, error } = await getSupabaseClient()
    .from("itinerary_items")
    .select(ITINERARY_ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new ItineraryItemNotFoundError(id);
  return toItineraryItem(data as SupabaseItineraryItemRow);
}

async function deletePlace(id: number): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("places")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new PlaceNotFoundError(id);
}

async function deleteItineraryItem(id: number): Promise<void> {
  const { error, count } = await getSupabaseClient()
    .from("itinerary_items")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) throwSupabaseError(error);
  if (count === 0) throw new ItineraryItemNotFoundError(id);
}

async function updateRouteSegmentMode(
  id: number,
  mode: TravelMode,
): Promise<RouteSegment> {
  const { data, error } = await getSupabaseClient()
    .from("route_segments")
    .update({ mode, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, from_item_id, to_item_id, mode, created_at, updated_at")
    .maybeSingle();

  if (error) throwSupabaseError(error);
  if (!data) throw new RouteSegmentNotFoundError(id);
  return data as RouteSegment;
}

async function replaceSegments(
  deleteIds: number[],
  inserts: RouteSegmentInsert[],
): Promise<void> {
  const client = getSupabaseClient();

  if (deleteIds.length > 0) {
    const { error } = await client
      .from("route_segments")
      .delete()
      .in("id", deleteIds);
    if (error) throwSupabaseError(error);
  }

  if (inserts.length > 0) {
    const { error } = await client.from("route_segments").insert(inserts);
    if (error) throwSupabaseError(error);
  }
}

async function reconcileAllRoutes(): Promise<void> {
  const items = await listItineraryItems();
  const routeSegments = await listRouteSegments();
  const plan = reconcileRouteSegments(items, routeSegments);

  await replaceSegments(plan.toDeleteIds, plan.toInsert);
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

function toPlaceInsert(input: PlaceCreateInput): PlaceInsert {
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
