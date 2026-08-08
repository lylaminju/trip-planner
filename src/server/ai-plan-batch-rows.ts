import type {
  AiDestinationCandidate,
  AiTransitHubType,
  TripLodging,
  TripTransitPoint,
} from "@/lib/types";
import {
  LODGING_FALLBACK_EMOJI,
  LUNCH_FALLBACK_EMOJI,
  transitHubFallbackEmoji,
} from "@/lib/place-fallback-emoji";
import { extractNoteLinks } from "@/lib/note-links";
import { buildGoogleMapsPlaceLinkUrl } from "@/lib/maps-url";
import { arrivalBufferMinutes } from "@/lib/transit-buffers";
import {
  formatVisitTime,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";
import type { AiItineraryPlan } from "./openai-ai-planner";
import {
  createDayScheduleCursor,
  NO_DWELL_TIME,
} from "./ai-plan-day-schedule";
import {
  lunchDisplayNotes,
  type EnrichedLunchStop,
} from "./ai-lunch-enrichment";
import type { Coordinates } from "@/lib/geo-distance";

export type { Coordinates };

export type GeneratedScheduleEntry = {
  date: string;
  startTime: string;
  placeId: number;
  notes: string | null;
  location: Coordinates;
  order: number;
};

export type GeneratedAnchorPlaceIds = {
  arrivalPlaceId: number | null;
  lodgingPlaceId: number | null;
  departurePlaceId: number | null;
  candidatePlaceIds: number[];
  lunchPlaceIdsByDate: Map<string, number>;
};

export type GeneratedAnchorLayout = {
  hasArrival: boolean;
  hasLodging: boolean;
  hasDeparture: boolean;
  // A round trip leaves from the stop it arrived at. The place row is written
  // once and both anchor visits point at it, the way a multi-night lodging is
  // one place with a visit per day.
  departureReusesArrivalPlace: boolean;
};

export function generatedAnchorLayout(input: {
  lodging: TripLodging | null;
  arrivalPoint?: TripTransitPoint | null;
  departurePoint?: TripTransitPoint | null;
}): GeneratedAnchorLayout {
  const arrivalPoint = input.arrivalPoint ?? null;
  const departurePoint = input.departurePoint ?? null;

  return {
    hasArrival: arrivalPoint !== null,
    hasLodging: input.lodging !== null,
    hasDeparture: departurePoint !== null,
    departureReusesArrivalPlace: isSameTransitStop(arrivalPoint, departurePoint),
  };
}

// Lunch dates in the order their place rows are appended, so id splitting can
// map the inserted tail rows back to their trip dates.
export function lunchDatesInPlanOrder(
  plan: AiItineraryPlan,
  lunchByDate: Map<string, EnrichedLunchStop>,
): string[] {
  return plan.days
    .filter((day) => lunchByDate.has(day.date))
    .map((day) => day.date);
}

export function buildAiGeneratedPlaceRows(input: {
  tripId: number;
  generationId: number;
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
  arrivalPoint?: TripTransitPoint | null;
  departurePoint?: TripTransitPoint | null;
  lunchByDate?: Map<string, EnrichedLunchStop>;
}) {
  const visits = input.plan.days.flatMap((day) => day.visits);
  const layout = generatedAnchorLayout(input);
  const anchors = [
    input.arrivalPoint
      ? {
          location: input.arrivalPoint,
          fallbackEmoji: transitHubFallbackEmoji(input.arrivalPoint.hub_type),
        }
      : null,
    input.lodging
      ? { location: input.lodging, fallbackEmoji: LODGING_FALLBACK_EMOJI }
      : null,
    input.departurePoint && !layout.departureReusesArrivalPlace
      ? {
          location: input.departurePoint,
          fallbackEmoji: transitHubFallbackEmoji(input.departurePoint.hub_type),
        }
      : null,
  ].filter((anchor) => anchor !== null);

  return [
    ...anchors.map((anchor) =>
      anchorPlaceRow(
        input.tripId,
        input.generationId,
        anchor.location,
        anchor.fallbackEmoji,
      ),
    ),
    ...visits.map((visit) => {
      const candidate = input.candidateById.get(visit.candidate_id);
      if (!candidate) {
        throw new Error(`Candidate ${visit.candidate_id} is not available.`);
      }

      const note = extractNoteLinks(visit.notes);

      return candidatePlaceRow(
        input.tripId,
        input.generationId,
        candidate,
        note.notes,
        note.links,
      );
    }),
    // Lunch rows sit after all visit rows so the id split stays a fixed
    // anchors / visits / lunches layout.
    ...lunchDatesInPlanOrder(input.plan, input.lunchByDate ?? new Map()).map(
      (date) => {
        const lunch = input.lunchByDate?.get(date);
        if (!lunch) {
          throw new Error(`Lunch stop for ${date} is not available.`);
        }
        return lunchPlaceRow(input.tripId, input.generationId, lunch);
      },
    ),
  ];
}

export function splitGeneratedPlaceIds(
  placeIds: number[],
  layout: GeneratedAnchorLayout,
  lunchDates: string[] = [],
): GeneratedAnchorPlaceIds {
  let index = 0;
  const nextAnchorId = (present: boolean): number | null => {
    if (!present) return null;
    const placeId = placeIds[index];
    index += 1;
    return placeId ?? null;
  };

  const arrivalPlaceId = nextAnchorId(layout.hasArrival);
  const lodgingPlaceId = nextAnchorId(layout.hasLodging);
  const departurePlaceId = layout.departureReusesArrivalPlace
    ? arrivalPlaceId
    : nextAnchorId(layout.hasDeparture);

  const candidateEnd = placeIds.length - lunchDates.length;
  const lunchPlaceIdsByDate = new Map<string, number>();
  lunchDates.forEach((date, lunchIndex) => {
    const placeId = placeIds[candidateEnd + lunchIndex];
    if (Number.isInteger(placeId)) {
      lunchPlaceIdsByDate.set(date, placeId);
    }
  });

  return {
    arrivalPlaceId,
    lodgingPlaceId,
    departurePlaceId,
    candidatePlaceIds: placeIds.slice(index, candidateEnd),
    lunchPlaceIdsByDate,
  };
}

export function buildGeneratedScheduleEntries(input: {
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
  lodgingStartTime: string;
  lodgingPlaceId: number | null;
  arrivalPoint?: TripTransitPoint | null;
  arrivalPlaceId?: number | null;
  departurePoint?: TripTransitPoint | null;
  departurePlaceId?: number | null;
  candidatePlaceIds: number[];
  firstVisitTravelDurationsByDate?: Map<string, number>;
  lunchByDate?: Map<string, EnrichedLunchStop>;
  lunchPlaceIdsByDate?: Map<string, number>;
}): GeneratedScheduleEntry[] {
  const entries: GeneratedScheduleEntry[] = [];
  const arrivalPoint = input.arrivalPoint ?? null;
  const arrivalPlaceId = input.arrivalPlaceId ?? null;
  const departurePoint = input.departurePoint ?? null;
  const departurePlaceId = input.departurePlaceId ?? null;
  const firstDate = minPlanDate(input.plan);
  const lastDate = maxPlanDate(input.plan);
  let candidatePlaceIndex = 0;
  let order = 0;

  if (input.lodging && !Number.isInteger(input.lodgingPlaceId)) {
    throw new Error("Inserted lodging place was not returned.");
  }
  if (arrivalPoint && !Number.isInteger(arrivalPlaceId)) {
    throw new Error("Inserted arrival place was not returned.");
  }
  if (departurePoint && !Number.isInteger(departurePlaceId)) {
    throw new Error("Inserted departure place was not returned.");
  }

  for (const day of input.plan.days) {
    const dayStartsAtArrival =
      day.date === firstDate && arrivalPoint !== null;
    const dayAnchorStartTime = dayStartsAtArrival
      ? (arrivalPoint.event_time ?? input.lodgingStartTime)
      : input.lodgingStartTime;
    const firstOfDayTravelSeconds =
      input.firstVisitTravelDurationsByDate?.get(day.date) ?? null;
    let lastVisitEndTime: string | null = null;
    // Spaces the day's items: no two share a start time, and none begins before
    // the one before it has finished.
    const cursor = createDayScheduleCursor();
    // How the day's first attraction is reached once anchors are placed: the
    // time to leave from and the measured travel to add. Null means no measured
    // leg, so the model's own start time is trusted (rounded to the grid).
    let firstVisitAnchorTime: string | null = null;
    let firstVisitTravelSeconds: number | null = null;

    if (dayStartsAtArrival && arrivalPlaceId !== null) {
      entries.push({
        date: day.date,
        startTime: cursor.place(dayAnchorStartTime, NO_DWELL_TIME),
        placeId: arrivalPlaceId,
        notes: null,
        location: arrivalPoint,
        order,
      });
      order += 1;

      if (input.lodging && input.lodgingPlaceId !== null) {
        // On the arrival day the traveler drops bags at the lodging before
        // sightseeing: the hub egress buffer plus the measured hub-to-lodging
        // travel. The first attraction then flows from the lodging, which the
        // model already accounts for, so no measured leg is applied to it.
        const lodgingStopTime = lodgingStopAfterArrival(
          dayAnchorStartTime,
          arrivalPoint.hub_type,
          firstOfDayTravelSeconds,
        );
        entries.push({
          date: day.date,
          startTime: cursor.place(lodgingStopTime, NO_DWELL_TIME),
          placeId: input.lodgingPlaceId,
          notes: null,
          location: input.lodging,
          order,
        });
        order += 1;
      } else {
        // No lodging: the first attraction is reached straight from the hub.
        firstVisitAnchorTime = dayAnchorStartTime;
        firstVisitTravelSeconds = firstOfDayTravelSeconds;
      }
    } else if (input.lodging && input.lodgingPlaceId !== null) {
      entries.push({
        date: day.date,
        startTime: cursor.place(input.lodgingStartTime, NO_DWELL_TIME),
        placeId: input.lodgingPlaceId,
        notes: null,
        location: input.lodging,
        order,
      });
      order += 1;
      firstVisitAnchorTime = input.lodgingStartTime;
      firstVisitTravelSeconds = firstOfDayTravelSeconds;
    }

    const lunch = input.lunchByDate?.get(day.date) ?? null;
    const lunchPlaceId = input.lunchPlaceIdsByDate?.get(day.date) ?? null;
    const lunchStartMinutes = lunch ? parseVisitTime(lunch.start_time) : null;
    // Lunch slots in before the first visit that starts later than it; when no
    // visit does, it lands after the day's last visit.
    const lunchInsertIndex =
      lunchStartMinutes === null
        ? -1
        : day.visits.findIndex((visit) => {
            const visitMinutes = parseVisitTime(visit.start_time);
            return visitMinutes !== null && visitMinutes > lunchStartMinutes;
          });
    let lunchPushed = false;
    const pushLunchEntry = () => {
      if (lunchPushed || !lunch || lunchPlaceId === null) return;
      lunchPushed = true;

      const parsedMinutes = parseVisitTime(lunch.start_time);
      const startTime = cursor.place(
        parsedMinutes === null
          ? lunch.start_time
          : formatVisitTime(roundVisitMinutesUpToGrid(parsedMinutes)),
        lunch.duration_minutes,
      );
      entries.push({
        date: day.date,
        startTime,
        placeId: lunchPlaceId,
        notes: lunchDisplayNotes(lunch),
        location: { latitude: lunch.latitude, longitude: lunch.longitude },
        order,
      });
      lastVisitEndTime =
        visitEndTime(startTime, lunch.duration_minutes) ?? lastVisitEndTime;
      order += 1;
    };

    day.visits.forEach((visit, visitIndex) => {
      if (visitIndex === lunchInsertIndex) {
        pushLunchEntry();
      }
      const candidate = input.candidateById.get(visit.candidate_id);
      if (!candidate) {
        throw new Error(`Candidate ${visit.candidate_id} is not available.`);
      }
      const placeId = input.candidatePlaceIds[candidatePlaceIndex];
      if (!Number.isInteger(placeId)) {
        throw new Error("Inserted candidate place was not returned.");
      }

      const startTime = cursor.place(
        scheduleAfterAnchorTravel(
          visit.start_time,
          visitIndex === 0 ? firstVisitAnchorTime : null,
          visitIndex === 0 ? firstVisitTravelSeconds : null,
        ),
        visit.duration_minutes,
      );
      entries.push({
        date: day.date,
        startTime,
        placeId,
        // The visit note carries the same text as the place note, so it drops
        // its markdown links the same way; the URLs live on the place.
        notes: extractNoteLinks(visit.notes).notes,
        location: candidate,
        order,
      });
      lastVisitEndTime = visitEndTime(startTime, visit.duration_minutes);
      candidatePlaceIndex += 1;
      order += 1;
    });
    // A lunch later than every visit (or on a day with no visits) lands here.
    pushLunchEntry();

    if (day.date === lastDate && departurePoint && departurePlaceId !== null) {
      entries.push({
        date: day.date,
        startTime:
          departurePoint.event_time ?? lastVisitEndTime ?? dayAnchorStartTime,
        placeId: departurePlaceId,
        notes: null,
        location: departurePoint,
        order,
      });
      order += 1;
    }
  }

  return entries;
}

function isSameTransitStop(
  arrivalPoint: TripTransitPoint | null,
  departurePoint: TripTransitPoint | null,
): boolean {
  if (!arrivalPoint || !departurePoint) return false;

  // Transit points never carry a google_place_id, so identity is the resolved
  // stop itself: same name at the same coordinates. Both kinds are written from
  // one hub row or one resolved Maps URL, so the coordinates match exactly.
  return (
    arrivalPoint.name.trim() === departurePoint.name.trim() &&
    arrivalPoint.latitude === departurePoint.latitude &&
    arrivalPoint.longitude === departurePoint.longitude
  );
}

function minPlanDate(plan: AiItineraryPlan): string | null {
  return plan.days.reduce<string | null>(
    (min, day) => (min === null || day.date < min ? day.date : min),
    null,
  );
}

function maxPlanDate(plan: AiItineraryPlan): string | null {
  return plan.days.reduce<string | null>(
    (max, day) => (max === null || day.date > max ? day.date : max),
    null,
  );
}

function visitEndTime(
  startTime: string,
  durationMinutes: number,
): string | null {
  const startMinutes = parseVisitTime(startTime);
  if (
    startMinutes === null ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return null;
  }

  return formatVisitTime(
    roundVisitMinutesUpToGrid(startMinutes + durationMinutes),
  );
}

function lodgingStopAfterArrival(
  arrivalTime: string,
  hubType: AiTransitHubType | null,
  travelDurationSeconds: number | null,
): string {
  const arrivalMinutes = parseVisitTime(arrivalTime);
  if (arrivalMinutes === null) {
    return arrivalTime;
  }

  const travelMinutes =
    travelDurationSeconds !== null &&
    Number.isFinite(travelDurationSeconds) &&
    travelDurationSeconds >= 0
      ? Math.ceil(travelDurationSeconds / 60)
      : 0;
  // Spacing against the arrival stop is the day cursor's job; this only has to
  // add the hub's egress buffer and the measured ride.
  return formatVisitTime(
    roundVisitMinutesUpToGrid(
      arrivalMinutes + arrivalBufferMinutes(hubType) + travelMinutes,
    ),
  );
}

function scheduleAfterAnchorTravel(
  visitStartTime: string,
  anchorStartTime: string | null,
  travelDurationSeconds: number | null,
): string {
  const visitMinutes = parseVisitTime(visitStartTime);
  if (visitMinutes === null) {
    return visitStartTime;
  }

  const roundedVisitMinutes = roundVisitMinutesUpToGrid(visitMinutes);
  if (!anchorStartTime || travelDurationSeconds === null) {
    return formatVisitTime(roundedVisitMinutes);
  }

  const anchorMinutes = parseVisitTime(anchorStartTime);
  if (anchorMinutes === null) {
    return formatVisitTime(roundedVisitMinutes);
  }
  const travelMinutes = Math.ceil(travelDurationSeconds / 60);
  if (!Number.isFinite(travelMinutes) || travelMinutes < 0) {
    return formatVisitTime(roundedVisitMinutes);
  }

  const earliestVisitMinute = roundVisitMinutesUpToGrid(
    anchorMinutes + travelMinutes,
  );
  return formatVisitTime(Math.max(roundedVisitMinutes, earliestVisitMinute));
}

function candidatePlaceRow(
  tripId: number,
  generationId: number,
  candidate: AiDestinationCandidate,
  notes: string | null,
  links: string[],
) {
  return {
    trip_id: tripId,
    name: candidate.name,
    address: candidate.area,
    google_maps_url: buildGoogleMapsPlaceLinkUrl({
      name: candidate.name,
      address: candidate.area,
      googlePlaceId: candidate.google_place_id,
    }),
    google_place_id: candidate.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    notes,
    links,
    image_url: candidate.image_url,
    image_credit: candidate.image_credit,
    fallback_emoji: null,
    created_by_source: "ai",
    ai_generation_id: generationId,
  };
}

function lunchPlaceRow(
  tripId: number,
  generationId: number,
  lunch: EnrichedLunchStop,
) {
  return {
    trip_id: tripId,
    name: lunch.name,
    address: null,
    // Verified lunches carry Google's canonical link; unverified ones fall
    // back to a name search URL like curated candidates without a place id.
    google_maps_url:
      lunch.google_maps_url ??
      buildGoogleMapsPlaceLinkUrl({
        name: lunch.name,
        googlePlaceId: lunch.google_place_id,
      }),
    google_place_id: lunch.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: lunch.latitude,
    longitude: lunch.longitude,
    notes: lunchDisplayNotes(lunch),
    links: [],
    image_url: null,
    image_credit: null,
    fallback_emoji: LUNCH_FALLBACK_EMOJI,
    created_by_source: "ai",
    ai_generation_id: generationId,
  };
}

function anchorPlaceRow(
  tripId: number,
  generationId: number,
  anchor: Pick<
    TripLodging,
    "name" | "latitude" | "longitude" | "google_place_id"
  >,
  fallbackEmoji: string | null,
) {
  return {
    trip_id: tripId,
    name: anchor.name,
    address: null,
    google_maps_url: buildGoogleMapsPlaceLinkUrl({
      name: anchor.name,
      googlePlaceId: anchor.google_place_id,
    }),
    google_place_id: anchor.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    notes: null,
    links: [],
    image_url: null,
    image_credit: null,
    fallback_emoji: fallbackEmoji,
    created_by_source: "ai",
    ai_generation_id: generationId,
  };
}
