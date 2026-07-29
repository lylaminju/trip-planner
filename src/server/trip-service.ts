import { fillPresetTripGeo } from "@/lib/destination-options";
import {
  exceedsGuestTripLength,
  GUEST_TRIP_MAX_DAYS,
  isGuestDestinationSlug,
} from "@/lib/guest-mode";
import {
  applyTripDateShift,
  planTripDateShift,
  type TripDateRange,
} from "@/lib/trip-date-shift";
import type { Trip, TripMembership, TripSummary } from "@/lib/types";

import { storeDestinationPhoto } from "./destination-photo-service";
import { TripValidationError } from "./errors";
import { getSupabaseClient } from "./supabase";
import { listScheduledVisits } from "./supabase-place-store";
import { isGuestPrincipalId } from "./principal";
import { requireTripRole } from "./trip-access";
import { listTripMembers } from "./trip-members";

export type TripCreateInput = {
  name: string;
  destination: string;
  destination_slug: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_country_codes: string[] | null;
  // Already-fetched cover image (data URL) and its attribution. The image is
  // stored as-is; it is not re-fetched from Google here.
  destination_photo_data: string | null;
  destination_photo_attribution: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type TripUpdateInput = Partial<TripCreateInput>;

const TRIP_SELECT_FIELDS =
  "id, created_by, name, destination, destination_slug, destination_latitude, destination_longitude, destination_country_codes, destination_photo_url, destination_photo_attribution, start_date, end_date, created_at, updated_at";

export async function getTripById(tripId: number): Promise<Trip> {
  const { data, error } = await getSupabaseClient()
    .from("trips")
    .select(TRIP_SELECT_FIELDS)
    .eq("id", tripId)
    .is("deleted_at", null)
    .single();

  if (error) throwSupabaseError(error);
  return data as Trip;
}

export async function listTripsForRequest(
  userId: string,
): Promise<TripSummary[]> {
  const { data: membershipRows, error: membershipError } =
    await getSupabaseClient()
      .from("trip_memberships")
      .select("trip_id, user_id, role, created_at")
      .eq("user_id", userId);

  if (membershipError) throwSupabaseError(membershipError);

  const memberships = (membershipRows ?? []) as TripMembership[];
  if (memberships.length === 0) {
    return [];
  }

  const rolesByTripId = new Map(
    memberships.map((membership) => [membership.trip_id, membership.role]),
  );
  const { data: tripRows, error: tripError } = await getSupabaseClient()
    .from("trips")
    .select(TRIP_SELECT_FIELDS)
    .in(
      "id",
      memberships.map((membership) => membership.trip_id),
    )
    .is("deleted_at", null)
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (tripError) throwSupabaseError(tripError);

  const trips = (tripRows ?? []) as Trip[];
  const membersByTripId = await listTripMembers(trips.map((trip) => trip.id));

  return trips.map((trip) => ({
    ...trip,
    role: rolesByTripId.get(trip.id) ?? "viewer",
    members: membersByTripId.get(trip.id) ?? [],
  }));
}

export async function createTripForRequest(
  userId: string,
  input: TripCreateInput,
): Promise<TripSummary> {
  // Store the already-fetched cover image. Fails soft to a null URL so a
  // malformed image or upload error never blocks the trip.
  const destinationPhotoUrl = input.destination_photo_data
    ? await storeDestinationPhoto(userId, input.destination_photo_data)
    : null;

  // Preset destinations arrive with only a slug; store the preset's own
  // coordinates and country so the trip's columns are the source of truth.
  const geo = fillPresetTripGeo(input);

  const { data: tripRow, error: tripError } = await getSupabaseClient()
    .from("trips")
    .insert({
      created_by: userId,
      name: input.name,
      destination: input.destination,
      destination_slug: input.destination_slug,
      destination_latitude: geo.destination_latitude,
      destination_longitude: geo.destination_longitude,
      destination_country_codes: geo.destination_country_codes,
      destination_photo_url: destinationPhotoUrl,
      destination_photo_attribution: destinationPhotoUrl
        ? input.destination_photo_attribution
        : null,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select(TRIP_SELECT_FIELDS)
    .single();

  if (tripError) throwSupabaseError(tripError);
  const trip = tripRow as Trip;

  const { error: membershipError } = await getSupabaseClient()
    .from("trip_memberships")
    .insert({
      trip_id: trip.id,
      user_id: userId,
      role: "owner",
    });

  if (membershipError) {
    await getSupabaseClient().from("trips").delete().eq("id", trip.id);
    throwSupabaseError(membershipError);
  }

  const membersByTripId = await listTripMembers([trip.id]);
  return { ...trip, role: "owner", members: membersByTripId.get(trip.id) ?? [] };
}

export async function updateTripForRequest(
  tripId: number,
  userId: string,
  input: TripUpdateInput,
): Promise<TripSummary> {
  const membership = await requireTripRole(tripId, userId, "owner");
  const currentTrip = await getTripById(tripId);
  const { start_date, end_date, ...fieldInput } = input;
  const datesTouched = start_date !== undefined || end_date !== undefined;
  const nextDates: TripDateRange = {
    start_date: start_date !== undefined ? start_date : currentTrip.start_date,
    end_date: end_date !== undefined ? end_date : currentTrip.end_date,
  };
  validateTripDateRange(nextDates);
  validateGuestTripUpdate(userId, currentTrip, input, nextDates);

  // Date columns never go through this update: they must commit atomically
  // with the visit realignment below, or a failure in between strands the
  // itinerary on dates the trip no longer covers.
  if (Object.keys(fieldInput).length > 0 || !datesTouched) {
    const { error } = await getSupabaseClient()
      .from("trips")
      .update({ ...fieldInput, updated_at: new Date().toISOString() })
      .eq("id", tripId);

    if (error) throwSupabaseError(error);
  }

  if (datesTouched) {
    await commitTripDatesAndRealignVisits(tripId, currentTrip, nextDates);
  }

  const [trip, membersByTripId] = await Promise.all([
    getTripById(tripId),
    listTripMembers([tripId]),
  ]);
  return {
    ...trip,
    role: membership.role,
    members: membersByTripId.get(tripId) ?? [],
  };
}

/**
 * Keeps a trip's scheduled visits on the days they were planned for when its
 * dates move, so an existing itinerary follows the trip instead of stranding
 * itself on the old calendar dates. The trip's new dates and every visit-date
 * change commit in a single database transaction, and the previous dates are
 * sent along so a shift computed against stale dates aborts instead of
 * corrupting the itinerary.
 */
async function commitTripDatesAndRealignVisits(
  tripId: number,
  currentTrip: Trip,
  nextDates: TripDateRange,
): Promise<void> {
  const plan = planTripDateShift(currentTrip, nextDates);
  const changes =
    plan === null
      ? []
      : applyTripDateShift(await listScheduledVisits(tripId), plan);

  const { error } = await getSupabaseClient().rpc(
    "update_trip_dates_and_realign_visits",
    {
      p_trip_id: tripId,
      p_prev_start_date: currentTrip.start_date,
      p_prev_end_date: currentTrip.end_date,
      p_next_start_date: nextDates.start_date,
      p_next_end_date: nextDates.end_date,
      p_visit_changes: changes,
    },
  );

  if (error) throwSupabaseError(error);
}

export async function deleteTripForRequest(
  tripId: number,
  userId: string,
): Promise<void> {
  await requireTripRole(tripId, userId, "owner");
  const { error } = await getSupabaseClient()
    .from("trips")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tripId)
    .is("deleted_at", null);

  if (error) throwSupabaseError(error);
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}

// Guests keep their trips inside the demo envelope: curated destinations only
// and at most GUEST_TRIP_MAX_DAYS days.
function validateGuestTripUpdate(
  principalId: string,
  currentTrip: Trip,
  input: TripUpdateInput,
  nextDates: TripDateRange,
): void {
  if (!isGuestPrincipalId(principalId)) return;

  const changesDestination =
    input.destination !== undefined || input.destination_slug !== undefined;
  const nextSlug =
    input.destination_slug !== undefined
      ? input.destination_slug
      : currentTrip.destination_slug;
  if (changesDestination && !isGuestDestinationSlug(nextSlug)) {
    throw new TripValidationError(
      "Guest trips are limited to the curated destination list.",
    );
  }

  if (exceedsGuestTripLength(nextDates.start_date, nextDates.end_date)) {
    throw new TripValidationError(
      `Guest trips are limited to ${GUEST_TRIP_MAX_DAYS} days. Sign in to plan longer trips.`,
    );
  }
}

function validateTripDateRange(input: {
  start_date: string | null;
  end_date: string | null;
}): void {
  if (input.start_date && input.end_date && input.start_date > input.end_date) {
    throw new TripValidationError(
      "Trip start date must be before or equal to end date.",
    );
  }
}
