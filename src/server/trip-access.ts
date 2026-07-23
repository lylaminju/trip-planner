import type { TripMembership, TripRole } from "@/lib/types";
import { TripAccessDeniedError } from "@/server/errors";
import {
  guestIdFromPrincipalId,
  guestPrincipalId,
} from "@/server/principal";
import { getSupabaseClient } from "@/server/supabase";

const ROLE_RANK: Record<TripRole, number> = {
  viewer: 0,
  owner: 1,
};

export async function requireTripRole(
  tripId: number,
  principalId: string,
  minimumRole: TripRole,
): Promise<TripMembership> {
  const guestId = guestIdFromPrincipalId(principalId);
  if (guestId !== null) {
    return requireGuestTripAccess(tripId, guestId);
  }

  return requireUserTripRole(tripId, principalId, minimumRole);
}

async function requireUserTripRole(
  tripId: number,
  userId: string,
  minimumRole: TripRole,
): Promise<TripMembership> {
  const { data, error } = await getSupabaseClient()
    .from("trip_memberships")
    .select("trip_id, user_id, role, created_at")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throwSupabaseError(error);
  const membership = data as TripMembership | null;
  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minimumRole]) {
    throw new TripAccessDeniedError(tripId);
  }

  return membership;
}

// A guest owns exactly the unexpired, undeleted trips carrying their guest id;
// there is no membership row, so guest access is checked on the trip itself.
// Guests act as the trip's owner, so no minimum-role comparison is needed.
async function requireGuestTripAccess(
  tripId: number,
  guestId: string,
): Promise<TripMembership> {
  const { data, error } = await getSupabaseClient()
    .from("trips")
    .select("id, guest_owner_id, expires_at, created_at")
    .eq("id", tripId)
    .eq("guest_owner_id", guestId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throwSupabaseError(error);

  const trip = data as {
    expires_at: string | null;
    created_at: string;
  } | null;
  const expiresAtMs = trip?.expires_at ? Date.parse(trip.expires_at) : NaN;
  if (!trip || !(expiresAtMs > Date.now())) {
    throw new TripAccessDeniedError(tripId);
  }

  return {
    trip_id: tripId,
    user_id: guestPrincipalId(guestId),
    role: "owner",
    created_at: trip.created_at,
  };
}

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
