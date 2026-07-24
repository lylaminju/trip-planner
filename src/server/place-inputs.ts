import type { ItineraryItem } from "@/lib/types";

export type PlaceInsert = {
  trip_id: number;
  name: string;
  address: string | null;
  google_maps_url: string;
  google_place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  links: string[];
  // Google's canonical name, kept apart from the user-editable `name` so a
  // repeat map-POI pick can reuse it without a billed Place Details lookup.
  // Write-once at create time: PlaceEditInput must never carry it.
  google_place_name?: string | null;
  image_url?: string | null;
  image_credit?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
};

export type PlaceUpdate = Partial<PlaceInsert>;

export type ItineraryItemInsert = {
  trip_id: number;
  place_id: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
};

export type ItineraryItemUpdate = Partial<
  Omit<ItineraryItemInsert, "trip_id" | "place_id">
>;

export type PlaceCreateInput = Omit<PlaceInsert, "trip_id"> & {
  itinerary_notes?: string | null;
};

// `google_place_name` is excluded, not merely omitted by convention: it holds
// Google's canonical name, is shared across accounts by the reuse lookup, and
// must never follow a user renaming their own copy of the place. Excluding it
// here makes that a compile error rather than something a mapper can regress.
export type PlaceEditInput = Omit<PlaceUpdate, "trip_id" | "google_place_name"> &
  Partial<Pick<ItineraryItem, "visit_date" | "visit_time">> & {
    itinerary_notes?: string | null;
  };
