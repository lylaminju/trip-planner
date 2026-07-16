import type { TripMembership, TripMemberSummary } from "@/lib/types";
import { getSupabaseClient } from "@/server/supabase";

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

function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
