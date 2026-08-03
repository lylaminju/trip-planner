import type { TripMembership, TripMemberSummary, TripRole } from "@/lib/types";
import { TripValidationError } from "@/server/errors";
import { getSupabaseClient } from "@/server/supabase";
import { throwSupabaseError } from "@/server/supabase-errors";

type ProfileRow = {
  user_id: string;
  username: string | null;
  profile_color: string | null;
};

export async function listTripMembers(
  tripIds: number[],
): Promise<Map<number, TripMemberSummary[]>> {
  const membersByTripId = new Map<number, TripMemberSummary[]>();
  if (tripIds.length === 0) {
    return membersByTripId;
  }

  const { data: membershipRows, error: membershipError } =
    await getSupabaseClient()
      .from("trip_memberships")
      .select("trip_id, user_id, role, created_at")
      .in("trip_id", tripIds)
      .order("created_at", { ascending: true });

  if (membershipError) throwSupabaseError(membershipError);

  const memberships = (membershipRows ?? []) as TripMembership[];
  if (memberships.length === 0) {
    return membersByTripId;
  }

  const userIds = [...new Set(memberships.map((entry) => entry.user_id))];
  const { data: profileRows, error: profileError } = await getSupabaseClient()
    .from("profiles")
    .select("user_id, username, profile_color")
    .in("user_id", userIds);

  if (profileError) throwSupabaseError(profileError);

  const profilesByUserId = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  for (const membership of sortMembershipsForDisplay(memberships)) {
    const profile = profilesByUserId.get(membership.user_id);
    const members = membersByTripId.get(membership.trip_id) ?? [];
    members.push({
      user_id: membership.user_id,
      role: membership.role,
      username: profile?.username ?? null,
      profile_color: profile?.profile_color ?? null,
    });
    membersByTripId.set(membership.trip_id, members);
  }

  return membersByTripId;
}

// Owner leads the badge stack; the query already ordered rows by created_at,
// and the stable sort keeps that order within each role.
export function sortMembershipsForDisplay(
  memberships: TripMembership[],
): TripMembership[] {
  return [...memberships].sort(
    (a, b) => Number(b.role === "owner") - Number(a.role === "owner"),
  );
}

export async function addTripMemberByEmail(
  tripId: number,
  email: string,
  role: TripRole,
): Promise<TripMemberSummary[]> {
  const { data: profileRow, error: profileError } = await getSupabaseClient()
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (profileError) throwSupabaseError(profileError);
  if (!profileRow) {
    throw new TripValidationError("No account found for that email.");
  }

  const userId = (profileRow as { user_id: string }).user_id;
  const { data: existingRow, error: existingError } = await getSupabaseClient()
    .from("trip_memberships")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throwSupabaseError(existingError);
  if (existingRow) {
    throw new TripValidationError("That user is already a member of this trip.");
  }

  const { error: insertError } = await getSupabaseClient()
    .from("trip_memberships")
    .insert({ trip_id: tripId, user_id: userId, role });

  if (insertError) throwSupabaseError(insertError);

  return listMembersForTrip(tripId);
}

export async function removeTripMember(
  tripId: number,
  userId: string,
): Promise<TripMemberSummary[]> {
  const { error } = await getSupabaseClient()
    .from("trip_memberships")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) throwSupabaseError(error);

  return listMembersForTrip(tripId);
}

async function listMembersForTrip(
  tripId: number,
): Promise<TripMemberSummary[]> {
  const membersByTripId = await listTripMembers([tripId]);
  return membersByTripId.get(tripId) ?? [];
}
