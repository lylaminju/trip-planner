import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { PlannerSnapshot, TravelMode } from "@/lib/types";

import { getDatabase } from "./db";
import { resolveGoogleMapsUrl } from "./google-url-resolver";
import {
  deletePlace,
  getPlaceById,
  insertPlace,
  listPlaces,
  listRouteSegments,
  replaceSegments,
  updatePlace,
  updateRouteSegmentMode,
  type PlaceInsert,
  type PlaceUpdate,
} from "./place-repository";

export type ResolvedPlaceUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolvePlaceUrl(rawUrl: string): Promise<ResolvedPlaceUrl> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);

  return {
    google_maps_url: resolved.google_maps_url,
    name: resolved.name,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  };
}

export function getPlannerSnapshot(): PlannerSnapshot {
  const db = getDatabase();

  return {
    places: listPlaces(db),
    routeSegments: listRouteSegments(db),
  };
}

export function createPlace(input: PlaceInsert): PlannerSnapshot {
  const db = getDatabase();
  const normalizedInput = normalizeScheduledPlaceInput(input);

  db.transaction(() => {
    insertPlace(db, normalizedInput);
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function editPlace(id: number, input: PlaceUpdate): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    const existingPlace = getPlaceById(db, id);
    const normalizedInput = normalizeScheduledPlaceUpdate(input, existingPlace.visit_date);
    updatePlace(db, id, normalizedInput);
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function removePlace(id: number): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    deletePlace(db, id);
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function schedulePlace(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): PlannerSnapshot {
  const db = getDatabase();
  const normalizedInput = normalizeScheduledPlaceUpdate({ visit_date, visit_time });

  db.transaction(() => {
    updatePlace(db, id, normalizedInput);
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function setRouteSegmentMode(id: number, mode: TravelMode): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    updateRouteSegmentMode(db, id, mode);
  })();

  return getPlannerSnapshot();
}

function reconcileAllRoutes(db: ReturnType<typeof getDatabase>): void {
  const places = listPlaces(db);
  const routeSegments = listRouteSegments(db);
  const plan = reconcileRouteSegments(places, routeSegments);

  replaceSegments(db, plan.toDeleteIds, plan.toInsert);
}

function normalizeScheduledPlaceInput(input: PlaceInsert): PlaceInsert {
  if (input.visit_date !== null) {
    return input;
  }

  return {
    ...input,
    visit_time: null,
  };
}

function normalizeScheduledPlaceUpdate(
  input: PlaceUpdate,
  currentVisitDate: string | null | undefined = undefined,
): PlaceUpdate {
  if (input.visit_date === null) {
    return {
      ...input,
      visit_time: null,
    };
  }

  if (input.visit_date === undefined && currentVisitDate === null) {
    return {
      ...input,
      visit_time: null,
    };
  }

  return input;
}
