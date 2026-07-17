import {
  applyTripDateShift,
  planTripDateShift,
  type TripDateRange,
} from "@/lib/trip-date-shift";
import type { Trip, TripMembership, TripSummary } from "@/lib/types";

import { TripValidationError } from "./errors";
import { getSupabaseClient } from "./supabase";
import {
  applyVisitDateChanges,
  listScheduledVisits,
  reconcileRoutesForTrip,
} from "./supabase-place-store";
import { requireTripRole } from "./trip-access";
import { listTripMembers } from "./trip-members";

export type TripCreateInput = {
  name: string;
  destination: string;
  destination_slug: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  start_date: string | null;
  end_date: string | null;
};

export type TripUpdateInput = Partial<TripCreateInput>;

const TRIP_SELECT_FIELDS =
  "id, created_by, name, destination, destination_slug, destination_latitude, destination_longitude, start_date, end_date, created_at, updated_at";

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
  const { data: tripRow, error: tripError } = await getSupabaseClient()
    .from("trips")
    .insert({
      created_by: userId,
      name: input.name,
      destination: input.destination,
      destination_slug: input.destination_slug,
      destination_latitude: input.destination_latitude,
      destination_longitude: input.destination_longitude,
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
  const nextDates: TripDateRange = {
    start_date:
      input.start_date !== undefined
        ? input.start_date
        : currentTrip.start_date,
    end_date:
      input.end_date !== undefined ? input.end_date : currentTrip.end_date,
  };
  validateTripDateRange(nextDates);

  const { data, error } = await getSupabaseClient()
    .from("trips")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", tripId)
    .select(TRIP_SELECT_FIELDS)
    .single();

  if (error) throwSupabaseError(error);

  await realignScheduledVisits(tripId, currentTrip, nextDates);

  const membersByTripId = await listTripMembers([tripId]);
  return {
    ...(data as Trip),
    role: membership.role,
    members: membersByTripId.get(tripId) ?? [],
  };
}

/**
 * Keeps a trip's scheduled visits on the days they were planned for when its
 * dates move, so an existing itinerary follows the trip instead of stranding
 * itself on the old calendar dates.
 */
async function realignScheduledVisits(
  tripId: number,
  previousDates: TripDateRange,
  nextDates: TripDateRange,
): Promise<void> {
  const plan = planTripDateShift(previousDates, nextDates);
  if (plan === null) {
    return;
  }

  const changes = applyTripDateShift(await listScheduledVisits(tripId), plan);
  if (changes.length === 0) {
    return;
  }

  await applyVisitDateChanges(tripId, changes);

  // Shifting every visit by one delta preserves each day's grouping and order,
  // so only an unscheduled visit can leave a segment dangling.
  if (changes.some((change) => change.visit_date === null)) {
    await reconcileRoutesForTrip(tripId);
  }
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
