import type { Place, PlannerSnapshot, TravelMode } from "@/lib/types";

import { resolveGoogleMapsUrl } from "./google-url-resolver";
import type {
  ItineraryItemUpdate,
  PlaceCreateInput,
  PlaceEditInput,
} from "./place-inputs";
import * as supabasePlaceService from "./supabase-place-service";
import { requireTripRole } from "./trip-access";

export type ResolvedPlaceUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolvePlaceUrl(
  rawUrl: string,
): Promise<ResolvedPlaceUrl> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);

  return {
    google_maps_url: resolved.google_maps_url,
    name: resolved.name,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  };
}

export async function getPlannerSnapshot(
  tripId: number,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.getPlannerSnapshot(tripId);
}

export async function getPlannerSnapshotForRequest(
  tripId: number,
  userId: string,
): Promise<PlannerSnapshot> {
  const membership = await requireTripRole(tripId, userId, "viewer");
  return {
    ...(await getPlannerSnapshot(tripId)),
    role: membership.role,
  };
}

export async function createPlace(
  tripId: number,
  input: PlaceCreateInput,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.createPlace(tripId, input);
}

export async function createPlaceForRequest(
  tripId: number,
  userId: string,
  input: PlaceCreateInput,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return createPlace(tripId, input);
}

export async function getPlaceByIdForRequest(
  tripId: number,
  userId: string,
  id: number,
): Promise<Place> {
  await requireTripRole(tripId, userId, "viewer");
  return supabasePlaceService.getPlaceById(tripId, id);
}

export async function editPlace(
  tripId: number,
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.editPlace(tripId, id, input);
}

export async function editPlaceForRequest(
  tripId: number,
  userId: string,
  id: number,
  input: PlaceEditInput,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return editPlace(tripId, id, input);
}

export async function removePlace(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.removePlace(tripId, id);
}

export async function removePlaceForRequest(
  tripId: number,
  userId: string,
  id: number,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return removePlace(tripId, id);
}

export async function schedulePlace(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.schedulePlace(
    tripId,
    id,
    visit_date,
    visit_time,
    notes,
  );
}

export async function schedulePlaceForRequest(
  tripId: number,
  userId: string,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
  notes: string | null = null,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return schedulePlace(tripId, id, visit_date, visit_time, notes);
}

export async function scheduleItineraryItem(
  tripId: number,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.scheduleItineraryItem(
    tripId,
    id,
    visit_date,
    visit_time,
  );
}

export async function scheduleItineraryItemForRequest(
  tripId: number,
  userId: string,
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return scheduleItineraryItem(tripId, id, visit_date, visit_time);
}

export async function editItineraryItem(
  tripId: number,
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.editItineraryItem(tripId, id, input);
}

export async function editItineraryItemForRequest(
  tripId: number,
  userId: string,
  id: number,
  input: ItineraryItemUpdate,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return editItineraryItem(tripId, id, input);
}

export async function removeItineraryItem(
  tripId: number,
  id: number,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.removeItineraryItem(tripId, id);
}

export async function removeItineraryItemForRequest(
  tripId: number,
  userId: string,
  id: number,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return removeItineraryItem(tripId, id);
}

export async function setRouteSegmentMode(
  tripId: number,
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  return supabasePlaceService.setRouteSegmentMode(tripId, id, mode);
}

export async function setRouteSegmentModeForRequest(
  tripId: number,
  userId: string,
  id: number,
  mode: TravelMode,
): Promise<PlannerSnapshot> {
  await requireTripRole(tripId, userId, "editor");
  return setRouteSegmentMode(tripId, id, mode);
}
