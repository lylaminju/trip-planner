import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { ItineraryItem, Place, PlannerSnapshot, RouteSegment, TravelMode } from "@/lib/types";
import {
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";
import type { ItineraryItemUpdate, PlaceCreateInput, PlaceEditInput } from "@/server/place-inputs";

export function createFakeSupabasePlaceService() {
  let placeId = 1;
  let itemId = 1;
  let segmentId = 1;
  let places: Place[] = [];
  let itineraryItems: ItineraryItem[] = [];
  let routeSegments: RouteSegment[] = [];

  function now() {
    return "2026-01-01T00:00:00.000Z";
  }

  function snapshot(): PlannerSnapshot {
    return {
      places: [...places].sort((a, b) => a.name.localeCompare(b.name)),
      itineraryItems: [...itineraryItems],
      routeSegments: [...routeSegments],
    };
  }

  function hydrateItem(item: Omit<ItineraryItem, "place">): ItineraryItem {
    return {
      ...item,
      place: getPlace(item.place_id),
    };
  }

  function getPlace(id: number): Place {
    const place = places.find((candidate) => candidate.id === id);
    if (!place) throw new PlaceNotFoundError(id);
    return place;
  }

  function reconcile() {
    itineraryItems = itineraryItems.map((item) => hydrateItem(item));
    const plan = reconcileRouteSegments(itineraryItems, routeSegments);
    routeSegments = routeSegments.filter((segment) => !plan.toDeleteIds.includes(segment.id));
    routeSegments.push(
      ...plan.toInsert.map((insert) => ({
        id: segmentId++,
        ...insert,
        created_at: now(),
        updated_at: now(),
      })),
    );
  }

  function insertItem(input: {
    place_id: number;
    visit_date: string | null;
    visit_time: string | null;
    notes: string | null;
  }) {
    const item = hydrateItem({
      id: itemId++,
      place_id: input.place_id,
      visit_date: input.visit_date,
      visit_time: input.visit_date === null ? null : input.visit_time,
      notes: input.notes,
      created_at: now(),
      updated_at: now(),
    });
    itineraryItems.push(item);
    return item;
  }

  return {
    async getPlannerSnapshot() {
      return snapshot();
    },

    async getPlaceById(id: number) {
      return getPlace(id);
    },

    async createPlace(input: PlaceCreateInput) {
      const place: Place = {
        id: placeId++,
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
        created_at: now(),
        updated_at: now(),
      };
      places.push(place);
      if (input.visit_date !== undefined && input.visit_date !== null) {
        insertItem({
          place_id: place.id,
          visit_date: input.visit_date,
          visit_time: input.visit_time ?? null,
          notes: input.itinerary_notes ?? null,
        });
      }
      reconcile();
      return snapshot();
    },

    async editPlace(id: number, input: PlaceEditInput) {
      const place = getPlace(id);
      places = places.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              ...Object.fromEntries(
                Object.entries(input).filter(
                  ([key, value]) => !["visit_date", "visit_time", "itinerary_notes"].includes(key) && value !== undefined,
                ),
              ),
              updated_at: now(),
            }
          : candidate,
      );

      if (input.visit_date !== undefined || input.visit_time !== undefined || input.itinerary_notes !== undefined) {
        const item = itineraryItems.find((candidate) => candidate.place_id === place.id);
        if (item && input.visit_date === null) {
          itineraryItems = itineraryItems.filter((candidate) => candidate.id !== item.id);
        } else if (item) {
          itineraryItems = itineraryItems.map((candidate) =>
            candidate.id === item.id
              ? hydrateItem({
                  ...candidate,
                  visit_date: input.visit_date !== undefined ? input.visit_date : candidate.visit_date,
                  visit_time: input.visit_time !== undefined ? input.visit_time : candidate.visit_time,
                  notes: input.itinerary_notes !== undefined ? input.itinerary_notes : candidate.notes,
                  updated_at: now(),
                })
              : candidate,
          );
        } else if (input.visit_date !== undefined && input.visit_date !== null) {
          insertItem({
            place_id: id,
            visit_date: input.visit_date,
            visit_time: input.visit_time ?? null,
            notes: input.itinerary_notes ?? null,
          });
        }
      }

      reconcile();
      return snapshot();
    },

    async removePlace(id: number) {
      getPlace(id);
      places = places.filter((place) => place.id !== id);
      itineraryItems = itineraryItems.filter((item) => item.place_id !== id);
      reconcile();
      return snapshot();
    },

    async schedulePlace(id: number, visit_date: string | null, visit_time: string | null, notes: string | null = null) {
      getPlace(id);
      if (visit_date !== null) {
        insertItem({ place_id: id, visit_date, visit_time, notes });
      }
      reconcile();
      return snapshot();
    },

    async scheduleItineraryItem(id: number, visit_date: string | null, visit_time: string | null) {
      const item = itineraryItems.find((candidate) => candidate.id === id);
      if (!item) throw new ItineraryItemNotFoundError(id);
      if (visit_date === null) {
        itineraryItems = itineraryItems.filter((candidate) => candidate.id !== id);
      } else {
        itineraryItems = itineraryItems.map((candidate) =>
          candidate.id === id ? hydrateItem({ ...candidate, visit_date, visit_time, updated_at: now() }) : candidate,
        );
      }
      reconcile();
      return snapshot();
    },

    async editItineraryItem(id: number, input: ItineraryItemUpdate) {
      const item = itineraryItems.find((candidate) => candidate.id === id);
      if (!item) throw new ItineraryItemNotFoundError(id);
      if (input.visit_date === null) {
        itineraryItems = itineraryItems.filter((candidate) => candidate.id !== id);
      } else {
        itineraryItems = itineraryItems.map((candidate) =>
          candidate.id === id
            ? hydrateItem({
                ...candidate,
                visit_date: input.visit_date !== undefined ? input.visit_date : candidate.visit_date,
                visit_time: input.visit_time !== undefined ? input.visit_time : candidate.visit_time,
                notes: input.notes !== undefined ? input.notes : candidate.notes,
                updated_at: now(),
              })
            : candidate,
        );
      }
      reconcile();
      return snapshot();
    },

    async removeItineraryItem(id: number) {
      if (!itineraryItems.some((item) => item.id === id)) throw new ItineraryItemNotFoundError(id);
      itineraryItems = itineraryItems.filter((item) => item.id !== id);
      reconcile();
      return snapshot();
    },

    async setRouteSegmentMode(id: number, mode: TravelMode) {
      if (!routeSegments.some((segment) => segment.id === id)) throw new RouteSegmentNotFoundError(id);
      routeSegments = routeSegments.map((segment) =>
        segment.id === id ? { ...segment, mode, updated_at: now() } : segment,
      );
      return snapshot();
    },
  };
}
