import type { Trip, TripMembership, TripSummary } from "@/lib/types";

import { TripValidationError } from "./errors";
import { getSupabaseClient } from "./supabase";
import { requireTripRole } from "./trip-access";

export type TripCreateInput = {
  name: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
};

export type TripUpdateInput = Partial<TripCreateInput>;

const TRIP_SELECT_FIELDS =
  "id, created_by, name, destination, start_date, end_date, created_at, updated_at";

export async function getTripById(tripId: number): Promise<Trip> {
  const { data, error } = await getSupabaseClient()
    .from("trips")
    .select(TRIP_SELECT_FIELDS)
    .eq("id", tripId)
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
    .order("start_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (tripError) throwSupabaseError(tripError);

  return ((tripRows ?? []) as Trip[]).map((trip) => ({
    ...trip,
    role: rolesByTripId.get(trip.id) ?? "viewer",
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

  return { ...trip, role: "owner" };
}

export async function updateTripForRequest(
  tripId: number,
  userId: string,
  input: TripUpdateInput,
): Promise<TripSummary> {
  const membership = await requireTripRole(tripId, userId, "owner");
  const currentTrip = await getTripById(tripId);
  validateTripDateRange({
    start_date:
      input.start_date !== undefined
        ? input.start_date
        : currentTrip.start_date,
    end_date:
      input.end_date !== undefined ? input.end_date : currentTrip.end_date,
  });

  const { data, error } = await getSupabaseClient()
    .from("trips")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", tripId)
    .select(TRIP_SELECT_FIELDS)
    .single();

  if (error) throwSupabaseError(error);
  return { ...(data as Trip), role: membership.role };
}

export async function deleteTripForRequest(
  tripId: number,
  userId: string,
): Promise<void> {
  await requireTripRole(tripId, userId, "owner");
  const { error } = await getSupabaseClient()
    .from("trips")
    .delete()
    .eq("id", tripId);

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
