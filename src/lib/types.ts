export type TravelMode = "walking" | "transit" | "bicycling" | "driving";
export type TripRole = "owner" | "viewer";

export type Trip = {
  id: number;
  created_by: string | null;
  name: string;
  destination: string;
  destination_slug: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TripMembership = {
  trip_id: number;
  user_id: string;
  role: TripRole;
  created_at: string;
};

export type TripSummary = Trip & {
  role: TripRole;
};

export type Place = {
  id: number;
  trip_id: number;
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  links: string[];
  image_url: string | null;
  image_credit: string | null;
  created_at: string;
  updated_at: string;
};

export type ItineraryItem = {
  id: number;
  trip_id: number;
  place_id: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  place: Place;
};

export type RouteSegment = {
  id: number;
  trip_id: number;
  from_item_id: number;
  to_item_id: number;
  mode: TravelMode;
  created_at: string;
  updated_at: string;
};

export type RouteGeometry = {
  segment_id: number;
  status: "ok" | "no_route";
  encoded_polyline?: string;
  duration_seconds?: number;
};

export type SegmentView = {
  fromItemId: number;
  toItemId: number;
  segment: RouteSegment;
};

export type ItineraryDay = {
  date: string;
  color: string;
  items: ItineraryItem[];
  segments: SegmentView[];
};

export type ItineraryView = {
  days: ItineraryDay[];
  unscheduled: Place[];
};

export type VisitDateOption = {
  value: string;
  label: string;
};

export type PlannerSnapshot = {
  places: Place[];
  itineraryItems: ItineraryItem[];
  routeSegments: RouteSegment[];
};

export type TripPlannerInitialData = {
  trip: Trip;
  role: TripRole;
  plannerSnapshot: PlannerSnapshot;
};

export type AiRegionDistanceTier = "central" | "nearby" | "day_trip";
export type AiIndoorOutdoor = "indoor" | "outdoor" | "mixed";

export type AiDestinationCandidate = {
  id: number;
  destination_slug: string;
  name: string;
  category: string;
  tags: string[];
  area: string | null;
  region_distance_tier: AiRegionDistanceTier;
  sort_order: number;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  typical_duration_minutes: number;
  indoor_outdoor: AiIndoorOutdoor | null;
  planning_note: string | null;
  blurb: string | null;
  image_url: string | null;
  image_credit: string | null;
  created_at: string;
  updated_at: string;
};

export type TripLodging = {
  id: number;
  trip_id: number;
  name: string;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type TripTransitPointKind = "arrival" | "departure";

export type AiTransitHubType =
  | "airport"
  | "train_station"
  | "bus_terminal"
  | "ferry_terminal";

export type AiDestinationTransitHub = {
  id: number;
  destination_slug: string;
  name: string;
  hub_type: AiTransitHubType;
  iata_code: string | null;
  latitude: number;
  longitude: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TripTransitPoint = {
  id: number;
  trip_id: number;
  kind: TripTransitPointKind;
  name: string;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  event_time: string | null;
  created_at: string;
  updated_at: string;
};

export type AiPlanningPreferenceInput = {
  visits_per_day_min: number;
  visits_per_day_max: number;
  interest_tags: string[];
  preferred_travel_modes: TravelMode[];
  must_see_candidate_ids: number[];
};

export type AiPlanningGenerationInput = AiPlanningPreferenceInput & {
  lodging_google_maps_url?: string | null;
  daily_start_time?: string | null;
  arrival_hub_id?: number | null;
  arrival_google_maps_url?: string | null;
  arrival_time?: string | null;
  departure_hub_id?: number | null;
  departure_google_maps_url?: string | null;
  departure_time?: string | null;
};

export type AiPlanningPreferences = AiPlanningPreferenceInput & {
  trip_id: number;
  created_at: string;
  updated_at: string;
};

export type AiPlanningSetup = {
  trip: Trip;
  isSupportedDestination: boolean;
  candidates: AiDestinationCandidate[];
  lodging: TripLodging | null;
  arrivalPoint: TripTransitPoint | null;
  departurePoint: TripTransitPoint | null;
  transitHubs: AiDestinationTransitHub[];
  preferences: AiPlanningPreferences | null;
};
