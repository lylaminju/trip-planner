import { describe, expect, it } from "vitest";

import {
  tripDestinationFormChange,
  tripMetadataPayloadFromForm,
  updateTripFormField,
} from "@/components/trip-form-state";
import type { TripFormState } from "@/components/trip-form-types";

describe("updateTripFormField", () => {
  it("updates a field from a captured value without reading a deferred event", () => {
    const form: TripFormState = {
      name: "Old name",
      destination: "",
      destinationSlug: null,
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    };
    const event = {
      currentTarget: { value: "2026-06-03" },
    };
    const value = event.currentTarget.value;
    event.currentTarget = null as unknown as { value: string };

    expect(updateTripFormField(form, "startDate", value)).toEqual({
      ...form,
      startDate: "2026-06-03",
    });
  });

  it("builds trip metadata without timezone state", () => {
    expect(
      tripMetadataPayloadFromForm({
        name: "Draft trip",
        destination: "Toronto",
        destinationSlug: "toronto",
        startDate: "2026-06-01",
        endDate: "",
      }),
    ).toEqual({
      name: "Draft trip",
      destination: "Toronto",
      destination_slug: "toronto",
      start_date: "2026-06-01",
      end_date: null,
    });
  });

  it("preserves custom destinations with a null destination slug", () => {
    expect(
      tripMetadataPayloadFromForm({
        name: "Rockies loop",
        destination: "Calgary + Banff",
        destinationSlug: null,
        startDate: "",
        endDate: "",
      }),
    ).toEqual({
      name: "Rockies loop",
      destination: "Calgary + Banff",
      destination_slug: null,
      start_date: null,
      end_date: null,
    });
  });

  it("sets destination slugs for curated destination text and clears custom text", () => {
    const form: TripFormState = {
      name: "Draft trip",
      destination: "",
      destinationSlug: null,
      startDate: "",
      endDate: "",
    };

    expect(tripDestinationFormChange(form, "Toronto")).toEqual({
      ...form,
      destination: "Toronto",
      destinationSlug: "toronto",
    });

    expect(tripDestinationFormChange(form, "Calgary + Banff")).toEqual({
      ...form,
      destination: "Calgary + Banff",
      destinationSlug: null,
    });
  });
});
