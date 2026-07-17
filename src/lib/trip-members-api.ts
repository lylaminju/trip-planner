import type { TripMemberSummary, TripRole } from "./types";

export async function addTripMember(
  tripId: number,
  email: string,
  role: TripRole,
): Promise<TripMemberSummary[]> {
  const response = await fetch(`/api/trips/${tripId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });

  return readMembersResponse(response, "Failed to invite member.");
}

export async function removeTripMember(
  tripId: number,
  userId: string,
): Promise<TripMemberSummary[]> {
  const response = await fetch(
    `/api/trips/${tripId}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );

  return readMembersResponse(response, "Failed to remove member.");
}

async function readMembersResponse(
  response: Response,
  fallbackError: string,
): Promise<TripMemberSummary[]> {
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : fallbackError,
    );
  }

  return Array.isArray(data.members)
    ? (data.members as TripMemberSummary[])
    : [];
}
