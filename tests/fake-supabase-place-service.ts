import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type {
  ItineraryItem,
  Place,
  PlannerSnapshot,
  RouteSegment,
  TravelMode,
} from "@/lib/types";
import {
  ItineraryItemNotFoundError,
  PlaceNotFoundError,
  RouteSegmentNotFoundError,
} from "@/server/errors";
import type {
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
} from "@/server/place-inputs";

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

  function snapshot(tripId: number): PlannerSnapshot {
    return {
      places: places
        .filter((place) => place.trip_id === tripId)
        .sort((a, b) => a.name.localeCompare(b.name)),
      itineraryItems: itineraryItems.filter((item) => item.trip_id === tripId),
      routeSegments: routeSegments.filter(
        (segment) => segment.trip_id === tripId,
      ),
    };
  }

  function hydrateItem(item: Omit<ItineraryItem, "place">): ItineraryItem {
    return {
      ...item,
      place: getPlace(item.trip_id, item.place_id),
    };
  }

  function getPlace(tripId: number, id: number): Place {
    const place = places.find(
      (candidate) => candidate.trip_id === tripId && candidate.id === id,
    );
    if (!place) throw new PlaceNotFoundError(id);
    return place;
  }

  function reconcile(tripId: number) {
    itineraryItems = itineraryItems.map((item) => hydrateItem(item));
    const plan = reconcileRouteSegments(
      itineraryItems.filter((item) => item.trip_id === tripId),
      routeSegments.filter((segment) => segment.trip_id === tripId),
    );
    routeSegments = routeSegments.filter(
      (segment) =>
        segment.trip_id !== tripId || !plan.toDeleteIds.includes(segment.id),
    );
    routeSegments.push(
      ...plan.toInsert.map((insert) => ({
        id: segmentId++,
        trip_id: tripId,
        ...insert,
        created_at: now(),
        updated_at: now(),
      })),
    );
  }

  function insertItem(input: {
    trip_id: number;
    place_id: number;
    visit_date: string | null;
    visit_time: string | null;
    notes: string | null;
  }) {
    const item = hydrateItem({
      id: itemId++,
      trip_id: input.trip_id,
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
    async getPlannerSnapshot(tripId: number) {
      return snapshot(tripId);
    },

    async getPlaceById(tripId: number, id: number) {
      return getPlace(tripId, id);
    },

    async createPlace(tripId: number, input: PlaceCreateInput) {
      const place: Place = {
        id: placeId++,
        trip_id: tripId,
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
        links: [...input.links],
        image_url: null,
        image_credit: null,
        created_at: now(),
        updated_at: now(),
      };
      places.push(place);
      if (input.visit_date !== undefined && input.visit_date !== null) {
        insertItem({
          trip_id: tripId,
          place_id: place.id,
          visit_date: input.visit_date,
          visit_time: input.visit_time ?? null,
          notes: input.itinerary_notes ?? null,
        });
      }
      reconcile(tripId);
      return snapshot(tripId);
    },

    async editPlace(tripId: number, id: number, input: PlaceEditInput) {
      const place = getPlace(tripId, id);
      places = places.map((candidate) =>
        candidate.trip_id === tripId && candidate.id === id
          ? {
              ...candidate,
              ...Object.fromEntries(
                Object.entries(input).filter(
                  ([key, value]) =>
                    !["visit_date", "visit_time", "itinerary_notes"].includes(
                      key,
                    ) && value !== undefined,
                ),
              ),
              updated_at: now(),
            }
          : candidate,
      );

      if (
        input.visit_date !== undefined ||
        input.visit_time !== undefined ||
        input.itinerary_notes !== undefined
      ) {
        const item = itineraryItems.find(
          (candidate) =>
            candidate.trip_id === tripId && candidate.place_id === place.id,
        );
        if (item && input.visit_date === null) {
          itineraryItems = itineraryItems.filter(
            (candidate) => candidate.id !== item.id,
          );
        } else if (item) {
          itineraryItems = itineraryItems.map((candidate) =>
            candidate.id === item.id
              ? hydrateItem({
                  ...candidate,
                  visit_date:
                    input.visit_date !== undefined
                      ? input.visit_date
                      : candidate.visit_date,
                  visit_time:
                    input.visit_time !== undefined
                      ? input.visit_time
                      : candidate.visit_time,
                  notes:
                    input.itinerary_notes !== undefined
                      ? input.itinerary_notes
                      : candidate.notes,
                  updated_at: now(),
                })
              : candidate,
          );
        } else if (
          input.visit_date !== undefined &&
          input.visit_date !== null
        ) {
          insertItem({
            trip_id: tripId,
            place_id: id,
            visit_date: input.visit_date,
            visit_time: input.visit_time ?? null,
            notes: input.itinerary_notes ?? null,
          });
        }
      }

      reconcile(tripId);
      return snapshot(tripId);
    },

    async removePlace(tripId: number, id: number) {
      getPlace(tripId, id);
      places = places.filter(
        (place) => place.trip_id !== tripId || place.id !== id,
      );
      itineraryItems = itineraryItems.filter(
        (item) => item.trip_id !== tripId || item.place_id !== id,
      );
      reconcile(tripId);
      return snapshot(tripId);
    },

    async schedulePlace(
      tripId: number,
      id: number,
      visit_date: string | null,
      visit_time: string | null,
      notes: string | null = null,
    ) {
      getPlace(tripId, id);
      if (visit_date !== null) {
        insertItem({
          trip_id: tripId,
          place_id: id,
          visit_date,
          visit_time,
          notes,
        });
      }
      reconcile(tripId);
      return snapshot(tripId);
    },

    async scheduleItineraryItem(
      tripId: number,
      id: number,
      visit_date: string | null,
      visit_time: string | null,
    ) {
      const item = itineraryItems.find(
        (candidate) => candidate.trip_id === tripId && candidate.id === id,
      );
      if (!item) throw new ItineraryItemNotFoundError(id);
      if (visit_date === null) {
        itineraryItems = itineraryItems.filter(
          (candidate) => candidate.trip_id !== tripId || candidate.id !== id,
        );
      } else {
        itineraryItems = itineraryItems.map((candidate) =>
          candidate.trip_id === tripId && candidate.id === id
            ? hydrateItem({
                ...candidate,
                visit_date,
                visit_time,
                updated_at: now(),
              })
            : candidate,
        );
      }
      reconcile(tripId);
      return snapshot(tripId);
    },

    async editItineraryItem(
      tripId: number,
      id: number,
      input: ItineraryItemUpdate,
    ) {
      const item = itineraryItems.find(
        (candidate) => candidate.trip_id === tripId && candidate.id === id,
      );
      if (!item) throw new ItineraryItemNotFoundError(id);
      if (input.visit_date === null) {
        itineraryItems = itineraryItems.filter(
          (candidate) => candidate.trip_id !== tripId || candidate.id !== id,
        );
      } else {
        itineraryItems = itineraryItems.map((candidate) =>
          candidate.trip_id === tripId && candidate.id === id
            ? hydrateItem({
                ...candidate,
                visit_date:
                  input.visit_date !== undefined
                    ? input.visit_date
                    : candidate.visit_date,
                visit_time:
                  input.visit_time !== undefined
                    ? input.visit_time
                    : candidate.visit_time,
                notes:
                  input.notes !== undefined ? input.notes : candidate.notes,
                updated_at: now(),
              })
            : candidate,
        );
      }
      reconcile(tripId);
      return snapshot(tripId);
    },

    async removeItineraryItem(tripId: number, id: number) {
      if (
        !itineraryItems.some(
          (item) => item.trip_id === tripId && item.id === id,
        )
      )
        throw new ItineraryItemNotFoundError(id);
      itineraryItems = itineraryItems.filter(
        (item) => item.trip_id !== tripId || item.id !== id,
      );
      reconcile(tripId);
      return snapshot(tripId);
    },

    async setRouteSegmentMode(tripId: number, id: number, mode: TravelMode) {
      if (
        !routeSegments.some(
          (segment) => segment.trip_id === tripId && segment.id === id,
        )
      )
        throw new RouteSegmentNotFoundError(id);
      routeSegments = routeSegments.map((segment) =>
        segment.trip_id === tripId && segment.id === id
          ? { ...segment, mode, updated_at: now() }
          : segment,
      );
      return snapshot(tripId);
    },
  };
}
