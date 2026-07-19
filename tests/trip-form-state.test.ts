import { describe, expect, it } from "vitest";

import {
  tripDestinationFormChange,
  tripMetadataPayloadFromForm,
  updateTripFormField,
} from "@/components/trip-form-state";
import type { TripFormState } from "@/components/trip-form-types";

const SAMPLE_PHOTO_DATA_URL = "data:image/jpeg;base64,AAAA";

describe("updateTripFormField", () => {
  it("updates a field from a captured value without reading a deferred event", () => {
    const form: TripFormState = {
      name: "Old name",
      destination: "",
      destinationSlug: null,
      destinationLatitude: null,
      destinationLongitude: null,
      destinationPhotoData: null,
      destinationPhotoAttribution: null,
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
        destinationLatitude: null,
        destinationLongitude: null,
        destinationPhotoData: null,
        destinationPhotoAttribution: null,
        startDate: "2026-06-01",
        endDate: "",
      }),
    ).toEqual({
      name: "Draft trip",
      destination: "Toronto",
      destination_slug: "toronto",
      destination_latitude: null,
      destination_longitude: null,
      destination_photo_data: null,
      destination_photo_attribution: null,
      start_date: "2026-06-01",
      end_date: null,
    });
  });

  it("carries the fetched cover image and attribution into the create payload", () => {
    expect(
      tripMetadataPayloadFromForm({
        name: "Yakushima getaway",
        destination: "Yakushima",
        destinationSlug: null,
        destinationLatitude: 30.3,
        destinationLongitude: 130.5,
        destinationPhotoData: SAMPLE_PHOTO_DATA_URL,
        destinationPhotoAttribution: "Jane Doe",
        startDate: "",
        endDate: "",
      }),
    ).toMatchObject({
      destination_photo_data: SAMPLE_PHOTO_DATA_URL,
      destination_photo_attribution: "Jane Doe",
    });
  });

  it("preserves custom destinations with a null destination slug", () => {
    expect(
      tripMetadataPayloadFromForm({
        name: "Rockies loop",
        destination: "Calgary + Banff",
        destinationSlug: null,
        destinationLatitude: null,
        destinationLongitude: null,
        destinationPhotoData: null,
        destinationPhotoAttribution: null,
        startDate: "",
        endDate: "",
      }),
    ).toEqual({
      name: "Rockies loop",
      destination: "Calgary + Banff",
      destination_slug: null,
      destination_latitude: null,
      destination_longitude: null,
      destination_photo_data: null,
      destination_photo_attribution: null,
      start_date: null,
      end_date: null,
    });
  });

  it("sets destination slugs for curated destination text and clears custom text", () => {
    const form: TripFormState = {
      name: "Draft trip",
      destination: "",
      destinationSlug: null,
      destinationLatitude: null,
      destinationLongitude: null,
      destinationPhotoData: null,
      destinationPhotoAttribution: null,
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

  it("clears a stale cover image when the destination is typed by hand", () => {
    const form: TripFormState = {
      name: "Draft trip",
      destination: "Yakushima",
      destinationSlug: null,
      destinationLatitude: 30.3,
      destinationLongitude: 130.5,
      destinationPhotoData: SAMPLE_PHOTO_DATA_URL,
      destinationPhotoAttribution: "Jane Doe",
      startDate: "",
      endDate: "",
    };

    expect(tripDestinationFormChange(form, "Yakushima Island")).toMatchObject({
      destinationLatitude: null,
      destinationLongitude: null,
      destinationPhotoData: null,
      destinationPhotoAttribution: null,
    });
  });
});
