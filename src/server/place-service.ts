import type { Place, PlannerSnapshot, TravelMode } from "@/lib/types";

import { resolveGoogleMapsUrl } from "./google-url-resolver";
import type {
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
} from "./place-inputs";
import * as supabasePlaceService from "./supabase-place-service";

export type ResolvedPlaceUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
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

export async function getPlannerSnapshot(): Promise<PlannerSnapshot> {
  return supabasePlaceService.getPlannerSnapshot();
}

export async function getPlannerSnapshotForRequest(): Promise<PlannerSnapshot> {
  return getPlannerSnapshot();
}

export async function createPlace(input: PlaceCreateInput): Promise<PlannerSnapshot> {
  return supabasePlaceService.createPlace(input);
}

export async function createPlaceForRequest(input: PlaceCreateInput): Promise<PlannerSnapshot> {
  return createPlace(input);
}

export async function getPlaceByIdForRequest(id: number): Promise<Place> {
  return supabasePlaceService.getPlaceById(id);
}

export async function editPlace(id: number, input: PlaceEditInput): Promise<PlannerSnapshot> {
  return supabasePlaceService.editPlace(id, input);
}

export async function editPlaceForRequest(
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  return editPlace(id, input);
}

export async function removePlace(id: number): Promise<PlannerSnapshot> {
  return supabasePlaceService.removePlace(id);
}

export async function removePlaceForRequest(id: number): Promise<PlannerSnapshot> {
  return removePlace(id);
}

export async function schedulePlace(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.schedulePlace(id, visit_date, visit_time, notes);
}

export async function schedulePlaceForRequest(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  return schedulePlace(id, visit_date, visit_time, notes);
}

export async function scheduleItineraryItem(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.scheduleItineraryItem(id, visit_date, visit_time);
}

export async function scheduleItineraryItemForRequest(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  return scheduleItineraryItem(id, visit_date, visit_time);
}

export async function editItineraryItem(
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.editItineraryItem(id, input);
}

export async function editItineraryItemForRequest(
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  return editItineraryItem(id, input);
}

export async function removeItineraryItem(id: number): Promise<PlannerSnapshot> {
  return supabasePlaceService.removeItineraryItem(id);
}

export async function removeItineraryItemForRequest(id: number): Promise<PlannerSnapshot> {
  return removeItineraryItem(id);
}

export async function setRouteSegmentMode(
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.setRouteSegmentMode(id, mode);
}

export async function setRouteSegmentModeForRequest(
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return setRouteSegmentMode(id, mode);
}
