import type {
  ItineraryItem,
  Place,
  PlannerSnapshot,
  RouteSegment,
  Trip,
  TripPlannerInitialData,
  TripSummary,
} from "@/lib/types";

const STAMP = "2026-05-20 00:00:00";
const ISO_STAMP = "2026-01-01T00:00:00.000Z";

export function buildPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: overrides.id ?? 1,
    trip_id: overrides.trip_id ?? 1,
    name: overrides.name ?? "Place",
    address: overrides.address ?? null,
    google_maps_url:
      overrides.google_maps_url ?? "https://www.google.com/maps/place",
    google_place_id: overrides.google_place_id ?? null,
    google_place_token: overrides.google_place_token ?? null,
    google_internal_ids: overrides.google_internal_ids ?? null,
    source_list_url: overrides.source_list_url ?? null,
    latitude: overrides.latitude ?? 40,
    longitude: overrides.longitude ?? -74,
    notes: overrides.notes ?? null,
    links: overrides.links ?? [],
    image_url: overrides.image_url ?? null,
    image_credit: overrides.image_credit ?? null,
    created_at: overrides.created_at ?? STAMP,
    updated_at: overrides.updated_at ?? STAMP,
  };
}

export function buildItineraryItem(
  overrides: Partial<ItineraryItem> = {},
): ItineraryItem {
  const place = overrides.place ?? buildPlace({ id: overrides.place_id ?? 1 });

  return {
    id: overrides.id ?? 1,
    trip_id: overrides.trip_id ?? place.trip_id,
    place_id: overrides.place_id ?? place.id,
    place,
    visit_date: overrides.visit_date ?? "2026-06-01",
    visit_time: overrides.visit_time ?? "09:00",
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? STAMP,
    updated_at: overrides.updated_at ?? STAMP,
  };
}

export function buildRouteSegment(
  overrides: Partial<RouteSegment> = {},
): RouteSegment {
  return {
    id: overrides.id ?? 10,
    trip_id: overrides.trip_id ?? 1,
    from_item_id: overrides.from_item_id ?? 1,
    to_item_id: overrides.to_item_id ?? 2,
    mode: overrides.mode ?? "walking",
    created_at: overrides.created_at ?? STAMP,
    updated_at: overrides.updated_at ?? STAMP,
  };
}

export function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: overrides.id ?? 1,
    created_by: overrides.created_by ?? "user-1",
    name: overrides.name ?? "Tokyo Spring",
    destination: overrides.destination ?? "Tokyo",
    destination_slug: overrides.destination_slug ?? "tokyo",
    destination_latitude: overrides.destination_latitude ?? null,
    destination_longitude: overrides.destination_longitude ?? null,
    destination_country_codes: overrides.destination_country_codes ?? null,
    destination_photo_url: overrides.destination_photo_url ?? null,
    destination_photo_attribution: overrides.destination_photo_attribution ?? null,
    start_date: overrides.start_date ?? "2026-04-01",
    end_date: overrides.end_date ?? "2026-04-07",
    created_at: overrides.created_at ?? ISO_STAMP,
    updated_at: overrides.updated_at ?? ISO_STAMP,
  };
}

export function buildTripSummary(
  overrides: Partial<TripSummary> = {},
): TripSummary {
  return {
    ...buildTrip({
      id: 12,
      name: "Toronto June",
      destination: "Toronto",
      destination_slug: "toronto",
      start_date: "2026-06-01",
      end_date: "2026-06-02",
      created_at: STAMP,
      updated_at: STAMP,
    }),
    role: "owner",
    members: [],
    ...overrides,
  };
}

export function buildPlannerSnapshot(
  overrides: Partial<PlannerSnapshot> = {},
): PlannerSnapshot {
  return {
    places: [],
    itineraryItems: [],
    routeSegments: [],
    ...overrides,
  };
}

export function buildTripPlannerInitialData(
  overrides: Partial<TripPlannerInitialData> = {},
): TripPlannerInitialData {
  return {
    trip: buildTrip(),
    role: "owner",
    members: [],
    plannerSnapshot: buildPlannerSnapshot(),
    ...overrides,
  };
}
