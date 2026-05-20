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
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ItineraryItem = {
  id: number;
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

export type PlannerSnapshot = {
  places: Place[];
  itineraryItems: ItineraryItem[];
  routeSegments: RouteSegment[];
};
