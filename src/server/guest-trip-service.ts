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
import { throwSupabaseError } from "./supabase-errors";

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
      `Guest trips are limited to ${GUEST_TRIP_MAX_DAYS} days. Sign in to plan longer trips.`,
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
// points, lodgings — into a fresh guest-owned ephemeral trip. Geometry needs no
// copying: the cache is keyed by route rather than by place row, so the clone's
// segments hit the same rows the source trip already populated.
//
// Cloned rows keep the source's created_by_source, so the sample's AI-generated
// content stays tagged 'ai' in the clone and the guest's first regeneration
// replaces it instead of stacking a second itinerary beside it. ai_generation_id
// is deliberately left null: the source ids belong to the sample trip's
// generations, and null is the shape deletePreviousAiBatch already sweeps.
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

  return { tripId };
}

// Lets the landing page decide whether to render the sample-trip CTA.
export function hasSampleTrip(): boolean {
  return sampleTripId() !== null;
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
      "id, name, address, google_maps_url, google_place_id, google_place_token, google_internal_ids, source_list_url, latitude, longitude, notes, links, image_url, image_credit, fallback_emoji, created_by_source",
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
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, place_id, visit_date, visit_time, notes, created_by_source")
    .eq("trip_id", sourceTripId)
    .order("id", { ascending: true });
  if (error) throwSupabaseError(error);

  const sourceRows = (data ?? []) as Array<{
    id: number;
    place_id: number;
    visit_date: string | null;
    visit_time: string | null;
    notes: string | null;
    created_by_source: string;
  }>;
  const itemIdMap = new Map<number, number>();
  if (sourceRows.length === 0) return { itemIdMap };

  const { data: inserted, error: insertError } = await supabase
    .from("itinerary_items")
    .insert(
      sourceRows.map((row) => ({
        trip_id: tripId,
        place_id: placeIdMap.get(row.place_id),
        visit_date: row.visit_date,
        visit_time: row.visit_time,
        notes: row.notes,
        created_by_source: row.created_by_source,
      })),
    )
    .select("id");
  if (insertError) throwSupabaseError(insertError);

  const insertedRows = (inserted ?? []) as Array<{ id: number }>;
  sourceRows.forEach((row, index) => {
    itemIdMap.set(row.id, insertedRows[index].id);
  });
  return { itemIdMap };
}

async function cloneRouteSegments(
  sourceTripId: number,
  tripId: number,
  itemIdMap: Map<number, number>,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("route_segments")
    .select("from_item_id, to_item_id, mode, created_by_source")
    .eq("trip_id", sourceTripId);
  if (error) throwSupabaseError(error);

  const rows = (data ?? []) as Array<{
    from_item_id: number;
    to_item_id: number;
    mode: TravelMode;
    created_by_source: string;
  }>;
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("route_segments").insert(
    rows.map((row) => ({
      trip_id: tripId,
      from_item_id: itemIdMap.get(row.from_item_id),
      to_item_id: itemIdMap.get(row.to_item_id),
      mode: row.mode,
      created_by_source: row.created_by_source,
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
