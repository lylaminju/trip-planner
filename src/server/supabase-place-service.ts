import type {
  Place,
  PlannerSnapshot,
  TravelMode,
} from "@/lib/types";
import type {
  ItineraryItemInsert,
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
  PlaceInsert,
  PlaceUpdate,
} from "@/server/place-inputs";
import {
  deleteAllItineraryItems,
  deleteAllPlaces,
  deleteItineraryItem,
  deletePlace,
  getPlaceById as getStoredPlaceById,
  insertItineraryItem,
  insertPlace,
  listItineraryItems,
  listItineraryItemsByPlaceId,
  listPlaces,
  listRouteSegments,
  reconcileRoutesForTrip,
  updateItineraryItem,
  updatePlace,
  updateRouteSegmentMode,
} from "./supabase-place-store";

export async function getPlannerSnapshot(
  tripId: number,
): Promise<PlannerSnapshot> {
  const [places, itineraryItems, routeSegments] = await Promise.all([
    listPlaces(tripId),
    listItineraryItems(tripId),
    listRouteSegments(tripId),
  ]);

  return { places, itineraryItems, routeSegments };
}

export async function getPlaceById(tripId: number, id: number): Promise<Place> {
  return getStoredPlaceById(tripId, id);
}

export async function createPlace(
  tripId: number,
  input: PlaceCreateInput,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, async () => {
    const place = await insertPlace(toPlaceInsert(tripId, input));
    await insertVisitIfScheduled(
      tripId,
      place.id,
      input.visit_date,
      input.visit_time,
      input.itinerary_notes,
    );
  });
}

export async function editPlace(
  tripId: number,
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, async () => {
    await updatePlace(tripId, id, toPlaceUpdate(input));
    await updatePlaceVisit(tripId, id, input);
  });
}

export async function removePlace(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, () => deletePlace(tripId, id));
}

export async function removeAllPlaces(
  tripId: number,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, () => deleteAllPlaces(tripId));
}

export async function schedulePlace(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, async () => {
    await getStoredPlaceById(tripId, id);
    await insertVisitIfScheduled(tripId, id, visit_date, visit_time, notes);
  });
}

export async function scheduleItineraryItem(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, () =>
    saveOrDeleteItineraryItem(
      tripId,
      id,
      normalizeItineraryItemUpdate({
        visit_date,
        visit_time,
      }),
    ),
  );
}

export async function editItineraryItem(
  tripId: number,
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, async () => {
    const currentItem = (await listItineraryItems(tripId)).find(
      (item) => item.id === id,
    );
    await saveOrDeleteItineraryItem(
      tripId,
      id,
      normalizeItineraryItemUpdate(input, currentItem?.visit_date),
    );
  });
}

export async function removeItineraryItem(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, () => deleteItineraryItem(tripId, id));
}

export async function removeAllItineraryItems(
  tripId: number,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(tripId, () => deleteAllItineraryItems(tripId));
}

export async function setRouteSegmentMode(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return runPlannerMutation(
    tripId,
    () => updateRouteSegmentMode(tripId, id, mode),
    { reconcile: false },
  );
}

async function runPlannerMutation(
  tripId: number,
  mutation: () => Promise<unknown>,
  options: { reconcile?: boolean } = {},
): Promise<PlannerSnapshot> {
  await mutation();
  if (options.reconcile !== false) {
    await reconcileRoutesForTrip(tripId);
  }
  return getPlannerSnapshot(tripId);
}

async function updatePlaceVisit(
  tripId: number,
  placeId: number,
  input: PlaceEditInput,
): Promise<void> {
  if (!hasPlaceVisitUpdate(input)) {
    return;
  }

  const item = (await listItineraryItemsByPlaceId(tripId, placeId))[0];
  const normalizedInput = normalizeItineraryItemUpdate(
    {
      visit_date: input.visit_date,
      visit_time: input.visit_time,
      notes: input.itinerary_notes,
    },
    item?.visit_date,
  );

  if (item) {
    await saveOrDeleteItineraryItem(tripId, item.id, normalizedInput);
    return;
  }

  await insertVisitIfScheduled(
    tripId,
    placeId,
    normalizedInput.visit_date,
    normalizedInput.visit_time,
    normalizedInput.notes,
  );
}

function hasPlaceVisitUpdate(input: PlaceEditInput): boolean {
  return (
    input.visit_date !== undefined ||
    input.visit_time !== undefined ||
    input.itinerary_notes !== undefined
  );
}

async function insertVisitIfScheduled(
  tripId: number,
  placeId: number,
  visitDate: string | null | undefined,
  visitTime: string | null | undefined,
  notes: string | null | undefined,
): Promise<void> {
  if (visitDate === undefined || visitDate === null) {
    return;
  }

  await insertItineraryItem(
    normalizeItineraryItemInput({
      trip_id: tripId,
      place_id: placeId,
      visit_date: visitDate,
      visit_time: visitTime ?? null,
      notes: notes ?? null,
    }),
  );
}

async function saveOrDeleteItineraryItem(
  tripId: number,
  itemId: number,
  input: ItineraryItemUpdate,
): Promise<void> {
  if (input.visit_date === null) {
    await deleteItineraryItem(tripId, itemId);
    return;
  }

  await updateItineraryItem(tripId, itemId, input);
}

function normalizeItineraryItemInput(
  input: ItineraryItemInsert,
): ItineraryItemInsert {
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

function toPlaceInsert(tripId: number, input: PlaceCreateInput): PlaceInsert {
  return {
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
    links: input.links,
    image_url: input.image_url ?? null,
    image_credit: input.image_credit ?? null,
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
    links: input.links,
  };
}
