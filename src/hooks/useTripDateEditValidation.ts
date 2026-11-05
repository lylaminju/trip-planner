import { useEffect, useState } from "react";

import { loadTripPlannerInitialData } from "@/lib/planner-api";
import {
  getTripDateChangeError,
  planTripDateShift,
  type ScheduledVisit,
  type TripDateRange,
} from "@/lib/trip-date-shift";

type LoadedItinerary = {
  key: string;
  tripDates: TripDateRange;
  visits: readonly ScheduledVisit[];
  failed: boolean;
};

/** Dashboard edit cards load the itinerary only while their editor is open. */
export function useTripDateEditValidation(
  trip: TripDateRange & { id: number },
  nextDates: TripDateRange,
) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedItinerary | null>(null);
  const { id: tripId, start_date: startDate, end_date: endDate } = trip;
  const key = JSON.stringify([tripId, startDate, endDate, attempt]);

  useEffect(() => {
    let active = true;
    loadTripPlannerInitialData(tripId).then(
      (data) => {
        if (!active) return;
        setLoaded({
          key,
          tripDates: data.trip,
          visits: data.plannerSnapshot.itineraryItems,
          failed: false,
        });
      },
      () => {
        if (!active) return;
        setLoaded({
          key,
          tripDates: { start_date: startDate, end_date: endDate },
          visits: [],
          failed: true,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [tripId, startDate, endDate, key]);

  const datesChanged =
    startDate !== nextDates.start_date || endDate !== nextDates.end_date;
  const current = loaded?.key === key ? loaded : null;
  const isChecking = datesChanged && current === null;
  const failed = datesChanged && current?.failed === true;
  const staleDates =
    current !== null &&
    (current.tripDates.start_date !== startDate ||
      current.tripDates.end_date !== endDate);
  const error =
    !datesChanged || !current
      ? null
      : failed
        ? "Couldn't check your itinerary. Retry before changing the dates."
        : staleDates
          ? "Trip dates changed elsewhere. Refresh the page and reopen the editor."
          : getTripDateChangeError(trip, nextDates, current.visits);
  const plan = planTripDateShift(trip, nextDates);
  const willShift =
    !error &&
    !isChecking &&
    Boolean(plan?.deltaDays) &&
    Boolean(current?.visits.some((visit) => visit.visit_date !== null));

  return {
    error,
    isChecking,
    willShift,
    retry: failed ? () => setAttempt((value) => value + 1) : undefined,
  };
}
