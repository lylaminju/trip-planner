import {
  formatVisitTime,
  nextVisitGridMinuteAfter,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";

/**
 * Lays one day's itinerary entries onto a timeline, pushing each start clear of
 * the entry before it.
 *
 * Two stops may not share a start time, and no stop may begin before the one
 * before it has finished. The second half is what start-time ordering alone
 * misses: the model regularly schedules a three-hour park and the next stop
 * ninety minutes later, and the measured anchor-travel push can close the gap
 * further, so a day's stops have to be spaced by their durations rather than
 * just sorted.
 *
 * Anchors are places the traveler leaves from rather than dwells at — the
 * arrival hub, the lodging — so they carry no duration and reserve only their
 * own slot.
 */

export const NO_DWELL_TIME = null;

export type DayScheduleCursor = {
  // Returns the start time to schedule, unchanged whenever it already clears
  // the previous entry.
  place(startTime: string, durationMinutes: number | null): string;
};

export function createDayScheduleCursor(): DayScheduleCursor {
  let previous: { start: number; end: number } | null = null;

  return {
    place(startTime, durationMinutes) {
      const parsed = parseVisitTime(startTime);
      // An unparseable time cannot be reasoned about, so it is passed through
      // and leaves the cursor where it was.
      if (parsed === null) return startTime;

      const start =
        previous === null
          ? parsed
          : Math.max(
              parsed,
              nextVisitGridMinuteAfter(previous.start),
              roundVisitMinutesUpToGrid(previous.end),
            );
      previous = { start, end: start + dwellMinutes(durationMinutes) };
      return start === parsed ? startTime : formatVisitTime(start);
    },
  };
}

function dwellMinutes(durationMinutes: number | null): number {
  if (durationMinutes === null) return 0;
  return Number.isInteger(durationMinutes) && durationMinutes > 0
    ? durationMinutes
    : 0;
}
