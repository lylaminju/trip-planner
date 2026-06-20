import { describe, expect, it } from "vitest";

import {
  tripMetadataPayloadFromForm,
  updateTripFormField,
} from "@/components/trip-form-state";
import type { TripFormState } from "@/components/trip-form-types";

describe("updateTripFormField", () => {
  it("updates a field from a captured value without reading a deferred event", () => {
    const form: TripFormState = {
      name: "Old name",
      destination: "",
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
        startDate: "2026-06-01",
        endDate: "",
      }),
    ).toEqual({
      name: "Draft trip",
      destination: "Toronto",
      start_date: "2026-06-01",
      end_date: null,
    });
  });
});
