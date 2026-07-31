import type {
  AiDestinationCandidate,
  AiTransitHubType,
  TripLodging,
  TripTransitPoint,
} from "@/lib/types";
import {
  LODGING_FALLBACK_EMOJI,
  transitHubFallbackEmoji,
} from "@/lib/place-fallback-emoji";
import { arrivalBufferMinutes } from "@/lib/transit-buffers";
import {
  formatVisitTime,
  nextVisitGridMinuteAfter,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";
import type { AiItineraryPlan } from "./openai-ai-planner";
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

export function buildAiGeneratedPlaceRows(input: {
  tripId: number;
  generationId: number;
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
  arrivalPoint?: TripTransitPoint | null;
  departurePoint?: TripTransitPoint | null;
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

      return candidatePlaceRow(
        input.tripId,
        input.generationId,
        candidate,
        visit.notes,
      );
    }),
  ];
}

export function splitGeneratedPlaceIds(
  placeIds: number[],
  layout: GeneratedAnchorLayout,
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

  return {
    arrivalPlaceId,
    lodgingPlaceId,
    departurePlaceId: layout.departureReusesArrivalPlace
      ? arrivalPlaceId
      : nextAnchorId(layout.hasDeparture),
    candidatePlaceIds: placeIds.slice(index),
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
    // Running start time of the last item placed on this day, so each following
    // item can be forced onto a later grid slot and no two items share a time.
    let previousStartMinutes: number | null = null;
    // How the day's first attraction is reached once anchors are placed: the
    // time to leave from and the measured travel to add. Null means no measured
    // leg, so the model's own start time is trusted (rounded to the grid).
    let firstVisitAnchorTime: string | null = null;
    let firstVisitTravelSeconds: number | null = null;

    if (dayStartsAtArrival && arrivalPlaceId !== null) {
      entries.push({
        date: day.date,
        startTime: dayAnchorStartTime,
        placeId: arrivalPlaceId,
        notes: null,
        location: arrivalPoint,
        order,
      });
      previousStartMinutes = parseVisitTime(dayAnchorStartTime);
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
          previousStartMinutes,
        );
        entries.push({
          date: day.date,
          startTime: lodgingStopTime,
          placeId: input.lodgingPlaceId,
          notes: null,
          location: input.lodging,
          order,
        });
        previousStartMinutes = parseVisitTime(lodgingStopTime);
        order += 1;
      } else {
        // No lodging: the first attraction is reached straight from the hub.
        firstVisitAnchorTime = dayAnchorStartTime;
        firstVisitTravelSeconds = firstOfDayTravelSeconds;
      }
    } else if (input.lodging && input.lodgingPlaceId !== null) {
      entries.push({
        date: day.date,
        startTime: input.lodgingStartTime,
        placeId: input.lodgingPlaceId,
        notes: null,
        location: input.lodging,
        order,
      });
      previousStartMinutes = parseVisitTime(input.lodgingStartTime);
      order += 1;
      firstVisitAnchorTime = input.lodgingStartTime;
      firstVisitTravelSeconds = firstOfDayTravelSeconds;
    }

    day.visits.forEach((visit, visitIndex) => {
      const candidate = input.candidateById.get(visit.candidate_id);
      if (!candidate) {
        throw new Error(`Candidate ${visit.candidate_id} is not available.`);
      }
      const placeId = input.candidatePlaceIds[candidatePlaceIndex];
      if (!Number.isInteger(placeId)) {
        throw new Error("Inserted candidate place was not returned.");
      }

      let startTime = scheduleAfterAnchorTravel(
        visit.start_time,
        visitIndex === 0 ? firstVisitAnchorTime : null,
        visitIndex === 0 ? firstVisitTravelSeconds : null,
      );
      let startMinutes = parseVisitTime(startTime);
      if (
        startMinutes !== null &&
        previousStartMinutes !== null &&
        startMinutes <= previousStartMinutes
      ) {
        startMinutes = nextVisitGridMinuteAfter(previousStartMinutes);
        startTime = formatVisitTime(startMinutes);
      }
      if (startMinutes !== null) {
        previousStartMinutes = startMinutes;
      }
      entries.push({
        date: day.date,
        startTime,
        placeId,
        notes: visit.notes,
        location: candidate,
        order,
      });
      lastVisitEndTime = visitEndTime(startTime, visit.duration_minutes);
      candidatePlaceIndex += 1;
      order += 1;
    });

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
  arrivalStartMinutes: number | null,
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
  let lodgingMinutes = roundVisitMinutesUpToGrid(
    arrivalMinutes + arrivalBufferMinutes(hubType) + travelMinutes,
  );
  if (arrivalStartMinutes !== null && lodgingMinutes <= arrivalStartMinutes) {
    lodgingMinutes = nextVisitGridMinuteAfter(arrivalStartMinutes);
  }
  return formatVisitTime(lodgingMinutes);
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
) {
  return {
    trip_id: tripId,
    name: candidate.name,
    address: candidate.area,
    google_maps_url: googleMapsSearchUrl(candidate),
    google_place_id: candidate.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    notes,
    links: [],
    image_url: candidate.image_url,
    image_credit: candidate.image_credit,
    fallback_emoji: null,
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
    google_maps_url: googleMapsSearchUrl(anchor),
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

function googleMapsSearchUrl(location: Coordinates): string {
  const query = encodeURIComponent(`${location.latitude},${location.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
