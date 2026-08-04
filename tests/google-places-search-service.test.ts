import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchPlaceNameAndPhotoReference,
  countPlacesCallsThisMonth,
  countUserPlacesCallsToday,
  recordPlacesCall,
} = vi.hoisted(() => ({
  fetchPlaceNameAndPhotoReference: vi.fn(),
  countPlacesCallsThisMonth: vi.fn(),
  countUserPlacesCallsToday: vi.fn(),
  recordPlacesCall: vi.fn(),
}));

vi.mock("@/server/google-places", () => ({
  fetchDestinationDetails: vi.fn(),
  fetchDestinationSuggestions: vi.fn(),
  fetchPlaceNameAndPhotoReference,
  fetchPlacePhoto: vi.fn(),
  requirePlacesApiKey: () => "test-key",
}));

vi.mock(
  "@/server/supabase-google-places-usage-store",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/supabase-google-places-usage-store")
    >()),
    countPlacesCallsThisMonth,
    countUserPlacesCallsToday,
    recordPlacesCall,
  }),
);

import { GooglePlacesRateLimitError } from "@/server/errors";
import { getPlaceNameAndPhoto } from "@/server/google-places-search-service";
import { PLACES_DETAILS_MONTHLY_LIMIT } from "@/lib/api-limits";
import { PLACES_SKU } from "@/server/supabase-google-places-usage-store";

// Resolving a map POI's name needs `displayName`, a Place Details Pro field, so
// this lookup is billed. It replaced a free IDs-Only call that was deliberately
// ungated — these cover the gating that had to come with that change.
describe("getPlaceNameAndPhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countPlacesCallsThisMonth.mockResolvedValue(0);
    countUserPlacesCallsToday.mockResolvedValue(0);
    recordPlacesCall.mockResolvedValue(undefined);
    fetchPlaceNameAndPhotoReference.mockResolvedValue({
      name: "Empire State Building",
      photo_name: null,
      photo_attribution: null,
    });
  });

  it("records the lookup against the details budget", async () => {
    const result = await getPlaceNameAndPhoto("user-1", "ChIJabc");

    expect(result.name).toBe("Empire State Building");
    expect(recordPlacesCall).toHaveBeenCalledWith("user-1", PLACES_SKU.DETAILS);
  });

  // Fail closed: the budget is checked before the call, never after, so an
  // exhausted ceiling can never be exceeded by the request that discovers it.
  it("refuses to spend once the monthly details budget is exhausted", async () => {
    countPlacesCallsThisMonth.mockResolvedValue(PLACES_DETAILS_MONTHLY_LIMIT);

    await expect(getPlaceNameAndPhoto("user-1", "ChIJabc")).rejects.toThrow(
      GooglePlacesRateLimitError,
    );
    expect(fetchPlaceNameAndPhotoReference).not.toHaveBeenCalled();
    expect(recordPlacesCall).not.toHaveBeenCalled();
  });
});
