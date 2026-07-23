import {
  exceedsGuestTripLength,
  GUEST_TRIP_MAX_DAYS,
  isGuestDestinationSlug,
} from "@/lib/guest-mode";
import { findDestinationOption } from "@/lib/destination-options";
import type { TravelMode } from "@/lib/types";

import { TripValidationError } from "./errors";
import { GUEST_TRIP_TTL_HOURS } from "./guest-session";
import { getSupabaseClient } from "./supabase";
import { routeGeometryCacheKey } from "./supabase-route-geometry-service";

const MS_PER_HOUR = 60 * 60 * 1000;

export type GuestTripCreateInput = {
  name: string;
  destination_slug: string;
  start_date: string | null;
  end_date: string | null;
};

export async function createGuestTrip(
  guestId: string,
  input: GuestTripCreateInput,
): Promise<{ tripId: number }> {
  if (!isGuestDestinationSlug(input.destination_slug)) {
    throw new TripValidationError(
      "Guest trips are limited to the curated destination list.",
    );
  }
  if (exceedsGuestTripLength(input.start_date, input.end_date)) {
    throw new TripValidationError(
      `Guest trips are limited to ${GUEST_TRIP_MAX_DAYS} days. Sign in with an invite to plan longer trips.`,
    );
  }

  const option = findDestinationOption(input.destination_slug);
  if (!option) {
    throw new TripValidationError(
      "Guest trips are limited to the curated destination list.",
    );
  }

  const { data, error } = await getSupabaseClient()
    .from("trips")
    .insert({
      created_by: null,
      guest_owner_id: guestId,
      expires_at: guestTripExpiryIso(),
      name: input.name,
      destination: option.name,
      destination_slug: option.slug,
      destination_latitude: option.latitude,
      destination_longitude: option.longitude,
      destination_country_codes: [option.countryCode],
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select("id")
    .single();

  if (error) throwSupabaseError(error);
  return { tripId: (data as { id: number }).id };
}

// Clones the configured sample trip — places, itinerary, segments, transit
// points, lodgings, and cached route geometry — into a fresh guest-owned
// ephemeral trip. Copied geometry is re-keyed to the cloned place ids so the
// clone renders its routes with zero Google Routes calls.
export async function cloneSampleTripForGuest(
  guestId: string,
): Promise<{ tripId: number }> {
  const sourceTripId = sampleTripId();
  if (sourceTripId === null) {
    throw new TripValidationError("The sample trip is not configured.");
  }

  const supabase = getSupabaseClient();

  const { data: sourceTrip, error: tripError } = await supabase
    .from("trips")
    .select(
      "name, destination, destination_slug, destination_latitude, destination_longitude, destination_country_codes, destination_photo_url, destination_photo_attribution, start_date, end_date",
    )
    .eq("id", sourceTripId)
    .is("deleted_at", null)
    .single();
  if (tripError) throwSupabaseError(tripError);

  const { data: newTripRow, error: insertError } = await supabase
    .from("trips")
    .insert({
      ...(sourceTrip as Record<string, unknown>),
      created_by: null,
      guest_owner_id: guestId,
      expires_at: guestTripExpiryIso(),
    })
    .select("id")
    .single();
  if (insertError) throwSupabaseError(insertError);
  const tripId = (newTripRow as { id: number }).id;

  const placeIdMap = await clonePlaces(sourceTripId, tripId);
  const itemMaps = await cloneItineraryItems(sourceTripId, tripId, placeIdMap);
  await cloneRouteSegments(sourceTripId, tripId, itemMaps.itemIdMap);
  await cloneTripChildRows(sourceTripId, tripId, "trip_transit_points");
  await cloneTripChildRows(sourceTripId, tripId, "trip_lodgings");
  await cloneRouteGeometry(sourceTripId, placeIdMap, itemMaps.placeIdByItemId);

  return { tripId };
}

function guestTripExpiryIso(): string {
  return new Date(Date.now() + GUEST_TRIP_TTL_HOURS * MS_PER_HOUR).toISOString();
}

function sampleTripId(): number | null {
  const raw = process.env.GUEST_SAMPLE_TRIP_ID?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

async function clonePlaces(
  sourceTripId: number,
  tripId: number,
): Promise<Map<number, number>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("places")
    .select(
      "id, name, address, google_maps_url, google_place_id, google_place_token, google_internal_ids, source_list_url, latitude, longitude, notes, links, image_url, image_credit",
    )
    .eq("trip_id", sourceTripId)
    .order("id", { ascending: true });
  if (error) throwSupabaseError(error);

  const sourceRows = (data ?? []) as Array<Record<string, unknown> & { id: number }>;
  const idMap = new Map<number, number>();
  if (sourceRows.length === 0) return idMap;

  const { data: inserted, error: insertError } = await supabase
    .from("places")
    .insert(
      sourceRows.map(({ id: _id, ...columns }) => ({
        ...columns,
        trip_id: tripId,
      })),
    )
    .select("id");
  if (insertError) throwSupabaseError(insertError);

  // Postgres RETURNING preserves the insert order of VALUES, so rows line up
  // with sourceRows by index.
  const insertedRows = (inserted ?? []) as Array<{ id: number }>;
  sourceRows.forEach((row, index) => {
    idMap.set(row.id, insertedRows[index].id);
  });
  return idMap;
}

async function cloneItineraryItems(
  sourceTripId: number,
  tripId: number,
  placeIdMap: Map<number, number>,
): Promise<{
  itemIdMap: Map<number, number>;
  placeIdByItemId: Map<number, number>;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, place_id, visit_date, visit_time, notes")
    .eq("trip_id", sourceTripId)
    .order("id", { ascending: true });
  if (error) throwSupabaseError(error);

  const sourceRows = (data ?? []) as Array<{
    id: number;
    place_id: number;
    visit_date: string | null;
    visit_time: string | null;
    notes: string | null;
  }>;
  const itemIdMap = new Map<number, number>();
  const placeIdByItemId = new Map<number, number>();
  if (sourceRows.length === 0) return { itemIdMap, placeIdByItemId };

  const { data: inserted, error: insertError } = await supabase
    .from("itinerary_items")
    .insert(
      sourceRows.map((row) => ({
        trip_id: tripId,
        place_id: placeIdMap.get(row.place_id),
        visit_date: row.visit_date,
        visit_time: row.visit_time,
        notes: row.notes,
      })),
    )
    .select("id");
  if (insertError) throwSupabaseError(insertError);

  const insertedRows = (inserted ?? []) as Array<{ id: number }>;
  sourceRows.forEach((row, index) => {
    itemIdMap.set(row.id, insertedRows[index].id);
    placeIdByItemId.set(row.id, row.place_id);
  });
  return { itemIdMap, placeIdByItemId };
}

async function cloneRouteSegments(
  sourceTripId: number,
  tripId: number,
  itemIdMap: Map<number, number>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("route_segments")
    .select("from_item_id, to_item_id, mode")
    .eq("trip_id", sourceTripId);
  if (error) throwSupabaseError(error);

  const rows = (data ?? []) as Array<{
    from_item_id: number;
    to_item_id: number;
    mode: TravelMode;
  }>;
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("route_segments").insert(
    rows.map((row) => ({
      trip_id: tripId,
      from_item_id: itemIdMap.get(row.from_item_id),
      to_item_id: itemIdMap.get(row.to_item_id),
      mode: row.mode,
    })),
  );
  if (insertError) throwSupabaseError(insertError);
}

async function cloneTripChildRows(
  sourceTripId: number,
  tripId: number,
  table: "trip_transit_points" | "trip_lodgings",
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("trip_id", sourceTripId);
  if (error) throwSupabaseError(error);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from(table).insert(
    rows.map(({ id: _id, created_at: _c, updated_at: _u, ...columns }) => ({
      ...columns,
      trip_id: tripId,
    })),
  );
  if (insertError) throwSupabaseError(insertError);
}

// Copies cached geometry rows from the source trip's segments, re-keyed for
// the cloned place ids. Missing cache rows are skipped; those segments fall
// back to the normal on-demand geometry path.
async function cloneRouteGeometry(
  sourceTripId: number,
  placeIdMap: Map<number, number>,
  placeIdByItemId: Map<number, number>,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("route_segments")
    .select("from_item_id, to_item_id, mode")
    .eq("trip_id", sourceTripId);
  if (error) throwSupabaseError(error);
  const segments = (data ?? []) as Array<{
    from_item_id: number;
    to_item_id: number;
    mode: TravelMode;
  }>;
  if (segments.length === 0) return;

  const placeIds = [...new Set([...placeIdByItemId.values()])];
  const { data: placeRows, error: placeError } = await supabase
    .from("places")
    .select("id, latitude, longitude")
    .in("id", placeIds);
  if (placeError) throwSupabaseError(placeError);
  const coordsByPlaceId = new Map(
    ((placeRows ?? []) as Array<{ id: number; latitude: number; longitude: number }>).map(
      (row) => [row.id, row],
    ),
  );

  const pairs = segments.flatMap((segment) => {
    const fromPlaceId = placeIdByItemId.get(segment.from_item_id);
    const toPlaceId = placeIdByItemId.get(segment.to_item_id);
    const from = fromPlaceId === undefined ? undefined : coordsByPlaceId.get(fromPlaceId);
    const to = toPlaceId === undefined ? undefined : coordsByPlaceId.get(toPlaceId);
    if (!from || !to) return [];
    return [
      {
        mode: segment.mode,
        from_place_id: from.id,
        from_latitude: from.latitude,
        from_longitude: from.longitude,
        to_place_id: to.id,
        to_latitude: to.latitude,
        to_longitude: to.longitude,
      },
    ];
  });
  if (pairs.length === 0) return;

  const sourceKeys = pairs.map((pair) => routeGeometryCacheKey(pair));
  const { data: cacheRows, error: cacheError } = await supabase
    .from("route_geometry_cache")
    .select(
      "cache_key, mode, from_latitude, from_longitude, to_latitude, to_longitude, status, encoded_polyline, duration_seconds",
    )
    .in("cache_key", sourceKeys);
  if (cacheError) throwSupabaseError(cacheError);
  const cacheByKey = new Map(
    ((cacheRows ?? []) as Array<Record<string, unknown> & { cache_key: string }>).map(
      (row) => [row.cache_key, row],
    ),
  );

  const clonedRows = pairs.flatMap((pair, index) => {
    const cached = cacheByKey.get(sourceKeys[index]);
    const newFromId = placeIdMap.get(pair.from_place_id);
    const newToId = placeIdMap.get(pair.to_place_id);
    if (!cached || newFromId === undefined || newToId === undefined) return [];

    const remapped = {
      ...pair,
      from_place_id: newFromId,
      to_place_id: newToId,
    };
    return [
      {
        cache_key: routeGeometryCacheKey(remapped),
        from_place_id: newFromId,
        to_place_id: newToId,
        mode: cached.mode,
        from_latitude: cached.from_latitude,
        from_longitude: cached.from_longitude,
        to_latitude: cached.to_latitude,
        to_longitude: cached.to_longitude,
        status: cached.status,
        encoded_polyline: cached.encoded_polyline,
        duration_seconds: cached.duration_seconds,
      },
    ];
  });
  if (clonedRows.length === 0) return;

  const { error: upsertError } = await supabase
    .from("route_geometry_cache")
    .upsert(clonedRows, { onConflict: "cache_key" });
  if (upsertError) throwSupabaseError(upsertError);
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
