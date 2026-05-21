import { describe, expect, it, vi } from "vitest";

import type { PlaceInsert } from "@/server/place-inputs";

const baseInput: PlaceInsert = {
  name: "Museum",
  address: null,
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40.7128,
  longitude: -74.006,
  visit_date: null,
  visit_time: null,
  notes: null,
};

async function withFreshPlaceService(
  run: (
    service: typeof import("@/server/place-service"),
  ) => Promise<void> | void,
): Promise<void> {
  vi.resetModules();
  vi.doMock("@/server/supabase-place-service", async () => {
    const { createFakeSupabasePlaceService } =
      await import("./fake-supabase-place-service");
    return createFakeSupabasePlaceService();
  });

  try {
    const service = await import("@/server/place-service");
    await run(service);
  } finally {
    vi.doUnmock("@/server/supabase-place-service");
    vi.resetModules();
  }
}

describe("place-service scheduling normalization", () => {
  it("does not create an itinerary item when a new place has no visit date", async () => {
    await withFreshPlaceService(async ({ createPlace }) => {
      const snapshot = await createPlace({
        ...baseInput,
        visit_date: null,
        visit_time: "09:00",
      });

      expect(snapshot.places).toHaveLength(1);
      expect(snapshot.itineraryItems).toEqual([]);
    });
  });

  it("deletes the first visit when legacy place edit clears visit_date", async () => {
    await withFreshPlaceService(async ({ createPlace, editPlace }) => {
      const created = await createPlace({
        ...baseInput,
        visit_date: "2026-06-01",
        visit_time: "09:00",
      });

      const snapshot = await editPlace(created.places[0].id, {
        visit_date: null,
        visit_time: "10:00",
      });

      expect(snapshot.itineraryItems).toEqual([]);
      expect(snapshot.routeSegments).toEqual([]);
    });
  });

  it("does not create an itinerary item when only visit_time changes for an unscheduled place", async () => {
    await withFreshPlaceService(async ({ createPlace, editPlace }) => {
      const created = await createPlace(baseInput);

      const snapshot = await editPlace(created.places[0].id, {
        visit_time: "10:00",
      });

      expect(snapshot.itineraryItems).toEqual([]);
      expect(snapshot.routeSegments).toEqual([]);
    });
  });

  it("deletes an itinerary item when scheduleItineraryItem moves it to unscheduled", async () => {
    await withFreshPlaceService(
      async ({ createPlace, scheduleItineraryItem }) => {
        const created = await createPlace({
          ...baseInput,
          visit_date: "2026-06-01",
          visit_time: "09:00",
        });

        const snapshot = await scheduleItineraryItem(
          created.itineraryItems[0].id,
          null,
          "11:00",
        );

        expect(snapshot.itineraryItems).toEqual([]);
        expect(snapshot.routeSegments).toEqual([]);
      },
    );
  });

  it("can create multiple visits for the same canonical place", async () => {
    await withFreshPlaceService(async ({ createPlace, schedulePlace }) => {
      const created = await createPlace({
        ...baseInput,
        visit_date: "2026-06-01",
        visit_time: "09:00",
      });

      const snapshot = await schedulePlace(
        created.places[0].id,
        "2026-06-01",
        "10:00",
      );

      expect(snapshot.places).toHaveLength(1);
      expect(snapshot.itineraryItems).toMatchObject([
        { place_id: created.places[0].id, visit_time: "09:00" },
        { place_id: created.places[0].id, visit_time: "10:00" },
      ]);
      expect(snapshot.routeSegments).toMatchObject([
        {
          from_item_id: snapshot.itineraryItems[0].id,
          to_item_id: snapshot.itineraryItems[1].id,
        },
      ]);
    });
  });

  it("edits itinerary item fields without changing the canonical place note", async () => {
    await withFreshPlaceService(async ({ createPlace, editItineraryItem }) => {
      const created = await createPlace({
        ...baseInput,
        notes: "Place note",
        visit_date: "2026-06-01",
        visit_time: "09:00",
      });

      const snapshot = await editItineraryItem(created.itineraryItems[0].id, {
        visit_date: "2026-06-02",
        visit_time: "10:00",
        notes: "Visit note",
      });

      expect(snapshot.places[0]).toMatchObject({ notes: "Place note" });
      expect(snapshot.itineraryItems[0]).toMatchObject({
        visit_date: "2026-06-02",
        visit_time: "10:00",
        notes: "Visit note",
      });
    });
  });
});
