import type { TripMembership, TripRole } from "@/lib/types";
import { TripAccessDeniedError } from "@/server/errors";
import { getSupabaseClient } from "@/server/supabase";

const ROLE_RANK: Record<TripRole, number> = {
  viewer: 0,
  owner: 1,
};

export async function requireTripRole(
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

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
