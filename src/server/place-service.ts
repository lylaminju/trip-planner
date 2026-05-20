import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { PlannerSnapshot, TravelMode } from "@/lib/types";

import { getDatabase } from "./db";
import { resolveGoogleMapsUrl } from "./google-url-resolver";
import {
  deleteItineraryItem,
  deletePlace,
  getPlaceById,
  insertItineraryItem,
  insertPlace,
  listItineraryItems,
  listItineraryItemsByPlaceId,
  listPlaces,
  listRouteSegments,
  replaceSegments,
  updateItineraryItem,
  updatePlace,
  updateRouteSegmentMode,
  type ItineraryItemInsert,
  type ItineraryItemUpdate,
  type PlaceInsert,
  type PlaceUpdate,
} from "./place-repository";

export type ResolvedPlaceUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PlaceCreateInput = PlaceInsert & {
  visit_date?: string | null;
  visit_time?: string | null;
  itinerary_notes?: string | null;
};

export type PlaceEditInput = PlaceUpdate &
  Partial<Pick<ItineraryItemUpdate, "visit_date" | "visit_time">> & {
    itinerary_notes?: string | null;
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
    itineraryItems: listItineraryItems(db),
    routeSegments: listRouteSegments(db),
  };
}

export function createPlace(input: PlaceCreateInput): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    const place = insertPlace(db, toPlaceInsert(input));
    if (input.visit_date !== undefined && input.visit_date !== null) {
      insertItineraryItem(
        db,
        normalizeItineraryItemInput({
          place_id: place.id,
          visit_date: input.visit_date,
          visit_time: input.visit_time ?? null,
          notes: input.itinerary_notes ?? null,
        }),
      );
    }
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function editPlace(id: number, input: PlaceEditInput): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    updatePlace(db, id, toPlaceUpdate(input));

    if (input.visit_date !== undefined || input.visit_time !== undefined || input.itinerary_notes !== undefined) {
      const item = listItineraryItemsByPlaceId(db, id)[0];
      const currentVisitDate = item?.visit_date;
      const normalizedInput = normalizeItineraryItemUpdate(
        {
          visit_date: input.visit_date,
          visit_time: input.visit_time,
          notes: input.itinerary_notes,
        },
        currentVisitDate,
      );

      if (item) {
        if (normalizedInput.visit_date === null) {
          deleteItineraryItem(db, item.id);
        } else {
          updateItineraryItem(db, item.id, normalizedInput);
        }
      } else if (normalizedInput.visit_date !== undefined && normalizedInput.visit_date !== null) {
        insertItineraryItem(
          db,
          normalizeItineraryItemInput({
            place_id: id,
            visit_date: normalizedInput.visit_date ?? null,
            visit_time: normalizedInput.visit_time ?? null,
            notes: normalizedInput.notes ?? null,
          }),
        );
      }
    }

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
  notes: string | null = null,
): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    getPlaceById(db, id);
    if (visit_date !== null) {
      insertItineraryItem(
        db,
        normalizeItineraryItemInput({
          place_id: id,
          visit_date,
          visit_time,
          notes,
        }),
      );
    }
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function scheduleItineraryItem(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): PlannerSnapshot {
  const db = getDatabase();
  const normalizedInput = normalizeItineraryItemUpdate({ visit_date, visit_time });

  db.transaction(() => {
    if (visit_date === null) {
      deleteItineraryItem(db, id);
    } else {
      updateItineraryItem(db, id, normalizedInput);
    }
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function editItineraryItem(id: number, input: ItineraryItemUpdate): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    const currentItem = listItineraryItems(db).find((item) => item.id === id);
    const normalizedInput = normalizeItineraryItemUpdate(input, currentItem?.visit_date);
    if (normalizedInput.visit_date === null) {
      deleteItineraryItem(db, id);
    } else {
      updateItineraryItem(db, id, normalizedInput);
    }
    reconcileAllRoutes(db);
  })();

  return getPlannerSnapshot();
}

export function removeItineraryItem(id: number): PlannerSnapshot {
  const db = getDatabase();

  db.transaction(() => {
    deleteItineraryItem(db, id);
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
  const items = listItineraryItems(db);
  const routeSegments = listRouteSegments(db);
  const plan = reconcileRouteSegments(items, routeSegments);

  replaceSegments(db, plan.toDeleteIds, plan.toInsert);
}

function normalizeItineraryItemInput(input: ItineraryItemInsert): ItineraryItemInsert {
  if (input.visit_date !== null) {
    return input;
  }

  return {
    ...input,
    visit_time: null,
  };
}

function normalizeItineraryItemUpdate(
  input: ItineraryItemUpdate,
  currentVisitDate: string | null | undefined = undefined,
): ItineraryItemUpdate {
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

function toPlaceInsert(input: PlaceCreateInput): PlaceInsert {
  return {
    name: input.name,
    address: input.address,
    google_maps_url: input.google_maps_url,
    place_id: input.place_id,
    google_place_token: input.google_place_token,
    google_internal_ids: input.google_internal_ids,
    source_list_url: input.source_list_url,
    latitude: input.latitude,
    longitude: input.longitude,
    notes: input.notes,
  };
}

function toPlaceUpdate(input: PlaceEditInput): PlaceUpdate {
  return {
    name: input.name,
    address: input.address,
    google_maps_url: input.google_maps_url,
    place_id: input.place_id,
    google_place_token: input.google_place_token,
    google_internal_ids: input.google_internal_ids,
    source_list_url: input.source_list_url,
    latitude: input.latitude,
    longitude: input.longitude,
    notes: input.notes,
  };
}
