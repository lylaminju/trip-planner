import { describe, expect, it, vi } from "vitest";

import {
  buildItineraryForTrip,
  formFromTrip,
} from "@/components/trip-planner-app-utils";
import {
  tripMetadataPayloadFromForm,
  tripUpdatePayloadFromForm,
} from "@/components/trip-form-state";
import { withFreshTripApiEnv } from "./helpers/trip-api-env";
import {
  buildItineraryItem,
  buildPlannerSnapshot,
  buildRouteSegment,
  buildTripSummary,
} from "./helpers/fixtures";

describe("trip date save response", () => {
  it("delivers shifted visits with the saved trip so the first visit stays on Day 1", async () => {
    await withFreshTripApiEnv(async () => {
      const trip = buildTripSummary({
        id: 1,
        start_date: "2027-02-08",
        end_date: "2027-02-14",
      });
      const firstVisit = buildItineraryItem({
        id: 1,
        visit_date: "2027-02-08",
        visit_time: "10:30",
      });
      const secondVisit = buildItineraryItem({
        id: 2,
        visit_date: "2027-02-08",
        visit_time: "11:30",
      });
      const snapshot = buildPlannerSnapshot({
        places: [firstVisit.place],
        itineraryItems: [firstVisit, secondVisit],
        routeSegments: [buildRouteSegment()],
      });
      const tripService = await import("@/server/trip-service");
      const placeService = await import("@/server/place-service");
      const save = vi
        .mocked(tripService.updateTripForRequest)
        .mockResolvedValue(trip);
      const load = vi
        .mocked(placeService.getPlannerSnapshot)
        .mockResolvedValue(snapshot);
      const { PATCH } = await import("@/app/api/trips/[tripId]/route");
      vi.spyOn(globalThis, "fetch").mockImplementation(async (path, init) =>
        PATCH(new Request(`http://localhost${path}`, init), {
          params: Promise.resolve({ tripId: "1" }),
        }),
      );

      const { updateTripWithPlanner } = await import("@/lib/trips-api");
      const result = await updateTripWithPlanner(
        1,
        tripMetadataPayloadFromForm(formFromTrip(trip)),
      );

      expect(result).toEqual({ trip, plannerSnapshot: snapshot });
      expect(save.mock.invocationCallOrder[0]).toBeLessThan(
        load.mock.invocationCallOrder[0],
      );
      const itinerary = buildItineraryForTrip(
        result.plannerSnapshot,
        result.trip,
      );
      expect(itinerary.days).toHaveLength(7);
      expect(itinerary.days[0].date).toBe("2027-02-08");
      expect(itinerary.days[0].items).toEqual([firstVisit, secondVisit]);
      expect(itinerary.days[0].segments[0].segment.mode).toBe("walking");
    });
  });

  it("does not resend unchanged dates when saving metadata from a stale editor", async () => {
    const original = buildTripSummary({
      start_date: "2027-02-15",
      end_date: "2027-02-21",
    });
    const latest = {
      ...original,
      start_date: "2027-03-01",
      end_date: "2027-03-07",
    };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        trip: latest,
        plannerSnapshot: buildPlannerSnapshot(),
      }),
    );
    try {
      const { updateTrip } = await import("@/lib/trips-api");
      const result = await updateTrip(
        original.id,
        tripUpdatePayloadFromForm(
          { ...formFromTrip(original), name: "Renamed" },
          original,
        ),
      );
      const sent = JSON.parse(fetch.mock.calls[0][1]?.body as string);
      expect(sent.name).toBe("Renamed");
      // Untouched dates must not revert a concurrent period edit.
      expect(sent).not.toHaveProperty("start_date");
      expect(sent).not.toHaveProperty("end_date");
      expect(result.start_date).toBe(latest.start_date);
    } finally {
      fetch.mockRestore();
    }
  });

  it.each([
    ["2027-03-01", "2027-03-07"],
    ["", ""],
    ["2027-02-15", "2027-02-23"],
  ])(
    "sends both dates for an intentional range edit: %s to %s",
    (startDate, endDate) => {
      const trip = buildTripSummary({
        start_date: "2027-02-15",
        end_date: "2027-02-21",
      });
      expect(
        tripUpdatePayloadFromForm(
          { ...formFromTrip(trip), startDate, endDate },
          trip,
        ),
      ).toMatchObject({
        start_date: startDate || null,
        end_date: endDate || null,
      });
    },
  );

  it("surfaces unsafe shortening as a validation error without loading a success snapshot", async () => {
    await withFreshTripApiEnv(async () => {
      const { TripValidationError } = await import("@/server/errors");
      const tripService = await import("@/server/trip-service");
      const placeService = await import("@/server/place-service");
      vi.mocked(tripService.updateTripForRequest).mockRejectedValue(
        new TripValidationError(
          "Your itinerary includes Day 7. Keep at least 7 days.",
        ),
      );
      const { PATCH } = await import("@/app/api/trips/[tripId]/route");
      const response = await PATCH(
        new Request("http://localhost/api/trips/1", {
          method: "PATCH",
          body: JSON.stringify({ end_date: "2027-02-10" }),
        }),
        { params: Promise.resolve({ tripId: "1" }) },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Your itinerary includes Day 7. Keep at least 7 days.",
      });
      expect(placeService.getPlannerSnapshot).not.toHaveBeenCalled();
    });
  });
});
