import type { ItineraryItem } from "@/lib/types";

export type PlaceInsert = {
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
  visit_date?: string | null;
  visit_time?: string | null;
};

export type PlaceUpdate = Partial<PlaceInsert>;

export type ItineraryItemInsert = {
  place_id: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
};

export type ItineraryItemUpdate = Partial<
  Omit<ItineraryItemInsert, "place_id">
>;

export type PlaceCreateInput = PlaceInsert & {
  itinerary_notes?: string | null;
};

export type PlaceEditInput = PlaceUpdate &
  Partial<Pick<ItineraryItem, "visit_date" | "visit_time">> & {
    itinerary_notes?: string | null;
  };
