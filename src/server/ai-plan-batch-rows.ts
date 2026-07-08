import type {
  AiDestinationCandidate,
  TripLodging,
} from "@/lib/types";
import {
  formatVisitTime,
  parseVisitTime,
  roundVisitMinutesUpToGrid,
} from "@/lib/visit-time";
import type { AiItineraryPlan } from "./openai-ai-planner";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeneratedScheduleEntry = {
  date: string;
  startTime: string;
  placeId: number;
  notes: string | null;
  location: Coordinates;
  order: number;
};

export function buildAiGeneratedPlaceRows(input: {
  tripId: number;
  generationId: number;
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
}) {
  const visits = input.plan.days.flatMap((day) => day.visits);

  return [
    ...(input.lodging
      ? [lodgingPlaceRow(input.tripId, input.generationId, input.lodging)]
      : []),
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

export function buildGeneratedScheduleEntries(input: {
  plan: AiItineraryPlan;
  candidateById: Map<number, AiDestinationCandidate>;
  lodging: TripLodging | null;
  lodgingStartTime: string;
  lodgingPlaceId: number | null;
  candidatePlaceIds: number[];
  firstVisitTravelDurationsByDate?: Map<string, number>;
}): GeneratedScheduleEntry[] {
  const entries: GeneratedScheduleEntry[] = [];
  let candidatePlaceIndex = 0;
  let order = 0;

  if (input.lodging && !Number.isInteger(input.lodgingPlaceId)) {
    throw new Error("Inserted lodging place was not returned.");
  }

  for (const day of input.plan.days) {
    if (input.lodging && input.lodgingPlaceId !== null) {
      entries.push({
        date: day.date,
        startTime: input.lodgingStartTime,
        placeId: input.lodgingPlaceId,
        notes: null,
        location: input.lodging,
        order,
      });
      order += 1;
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

      entries.push({
        date: day.date,
        startTime: scheduleAfterLodgingTravel(
          visit.start_time,
          input.lodging ? input.lodgingStartTime : null,
          visitIndex === 0
            ? (input.firstVisitTravelDurationsByDate?.get(day.date) ?? null)
            : null,
        ),
        placeId,
        notes: visit.notes,
        location: candidate,
        order,
      });
      candidatePlaceIndex += 1;
      order += 1;
    });
  }

  return entries;
}

function scheduleAfterLodgingTravel(
  visitStartTime: string,
  lodgingStartTime: string | null,
  travelDurationSeconds: number | null,
): string {
  const visitMinutes = parseVisitTime(visitStartTime);
  if (visitMinutes === null) {
    return visitStartTime;
  }

  const roundedVisitMinutes = roundVisitMinutesUpToGrid(visitMinutes);
  if (!lodgingStartTime || travelDurationSeconds === null) {
    return formatVisitTime(roundedVisitMinutes);
  }

  const lodgingMinutes = parseVisitTime(lodgingStartTime);
  if (lodgingMinutes === null) {
    return formatVisitTime(roundedVisitMinutes);
  }
  const travelMinutes = Math.ceil(travelDurationSeconds / 60);
  if (!Number.isFinite(travelMinutes) || travelMinutes < 0) {
    return formatVisitTime(roundedVisitMinutes);
  }

  const earliestVisitMinute = roundVisitMinutesUpToGrid(
    lodgingMinutes + travelMinutes,
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
    place_id: candidate.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    notes,
    links: [],
    created_by_source: "ai",
    ai_generation_id: generationId,
  };
}

function lodgingPlaceRow(
  tripId: number,
  generationId: number,
  lodging: TripLodging,
) {
  return {
    trip_id: tripId,
    name: lodging.name,
    address: lodging.address,
    google_maps_url: googleMapsSearchUrl(lodging),
    place_id: lodging.google_place_id,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: lodging.latitude,
    longitude: lodging.longitude,
    notes: null,
    links: [],
    created_by_source: "ai",
    ai_generation_id: generationId,
  };
}

function googleMapsSearchUrl(location: Coordinates): string {
  const query = encodeURIComponent(`${location.latitude},${location.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
