import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage } from "@/lib/error-message";
import { loadTripPlannerInitialData } from "@/lib/planner-api";
import {
  updateTripWithPlanner,
  type TripMetadataUpdatePayload,
} from "@/lib/trips-api";
import type {
  PlannerSnapshot,
  Trip,
  TripMemberSummary,
  TripPlannerInitialData,
  TripRole,
} from "@/lib/types";

const EMPTY_SNAPSHOT: PlannerSnapshot = {
  places: [],
  itineraryItems: [],
  routeSegments: [],
};

export function useTripPlannerData(
  tripId: number,
  initialData: TripPlannerInitialData | undefined,
  setError: (message: string | null) => void,
) {
  const [trip, setTrip] = useState<Trip | null>(
    () => initialData?.trip ?? null,
  );
  const [role, setRole] = useState<TripRole>(
    () => initialData?.role ?? "viewer",
  );
  const [members, setMembers] = useState<TripMemberSummary[]>(
    () => initialData?.members ?? [],
  );
  const [isGuest, setIsGuest] = useState(() => initialData?.isGuest ?? false);
  const [plannerSnapshot, setPlannerSnapshot] = useState<PlannerSnapshot>(
    () => initialData?.plannerSnapshot ?? EMPTY_SNAPSHOT,
  );
  const didUseInitialDataRef = useRef(Boolean(initialData));

  const reload = useCallback(async () => {
    const next = await loadTripPlannerInitialData(tripId);
    setTrip(next.trip);
    setRole(next.role);
    setMembers(next.members);
    setIsGuest(next.isGuest ?? false);
    setPlannerSnapshot(next.plannerSnapshot);
    setError(null);
  }, [tripId, setError]);

  useEffect(() => {
    if (didUseInitialDataRef.current) {
      didUseInitialDataRef.current = false;
      return;
    }
    reload().catch((reason) => {
      setError(errorMessage(reason, "Failed to load places."));
    });
  }, [reload, setError]);

  async function saveTrip(payload: TripMetadataUpdatePayload) {
    const next = await updateTripWithPlanner(tripId, payload);
    // React batches these updates: page context stays separate from mutable
    // planner data, while a render always sees the saved dates and visits.
    setTrip(next.trip);
    setRole(next.trip.role);
    setMembers(next.trip.members);
    setPlannerSnapshot(next.plannerSnapshot);
    setError(null);
  }

  return {
    trip,
    role,
    members,
    setMembers,
    isGuest,
    plannerSnapshot,
    setPlannerSnapshot,
    saveTrip,
  };
}
