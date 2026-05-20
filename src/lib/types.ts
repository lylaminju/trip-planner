export type TravelMode = "walking" | "transit" | "bicycling" | "driving";

export type Place = {
  id: number;
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteSegment = {
  id: number;
  from_place_id: number;
  to_place_id: number;
  mode: TravelMode;
  created_at: string;
  updated_at: string;
};

export type RouteGeometry = {
  segment_id: number;
  status: "ok" | "no_route";
  encoded_polyline?: string;
};

export type SegmentView = {
  fromPlaceId: number;
  toPlaceId: number;
  segment: RouteSegment;
};

export type ItineraryDay = {
  date: string;
  color: string;
  places: Place[];
  segments: SegmentView[];
};

export type ItineraryView = {
  days: ItineraryDay[];
  unscheduled: Place[];
};

export type PlannerSnapshot = {
  places: Place[];
  routeSegments: RouteSegment[];
};
