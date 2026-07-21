import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/destination-photo-service", () => ({
  storePlacePhoto: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

import { storePlacePhoto } from "@/server/destination-photo-service";
import { resolvePlaceImage } from "@/server/place-image-resolution";
import { getSupabaseClient } from "@/server/supabase";

const NO_IMAGE = { image_url: null, image_credit: null };

type ImageRow = { image_url: string | null; image_credit: string | null };
type TableResult = { data?: ImageRow[]; error?: { message: string } };

function stubImageQueries(resultsByTable: Record<string, TableResult>) {
  const queriesByTable: Record<
    string,
    { eq: ReturnType<typeof vi.fn> }
  > = {};
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? {};
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: result.data ?? null,
        error: result.error ?? null,
      }),
    };
    queriesByTable[table] = query;
    return query;
  });
  vi.mocked(getSupabaseClient).mockReturnValue({ from } as never);
  return { from, queriesByTable };
}

describe("resolvePlaceImage", () => {
  beforeEach(() => {
    vi.mocked(storePlacePhoto).mockReset();
    vi.mocked(getSupabaseClient).mockReset();
  });

  it("stores a supplied photo data URL and keeps its attribution", async () => {
    vi.mocked(storePlacePhoto).mockResolvedValue(
      "https://cdn.example.com/place-photos/user-1/a.jpg",
    );

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: "data:image/jpeg;base64,abc",
        photoAttribution: "Jane Doe",
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual({
      image_url: "https://cdn.example.com/place-photos/user-1/a.jpg",
      image_credit: "Jane Doe",
    });
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  // A rejected upload fails soft to no image instead of falling back to a
  // reused image: the user picked this place with a live photo in the preview.
  it("returns no image when the supplied photo cannot be stored", async () => {
    vi.mocked(storePlacePhoto).mockResolvedValue(null);

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: "data:image/gif;base64,notallowed",
        photoAttribution: "Jane Doe",
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual(NO_IMAGE);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it("reuses a saved place's stored image before consulting candidates", async () => {
    const { from } = stubImageQueries({
      places: {
        data: [
          {
            image_url: "https://cdn.example.com/place-photos/saved.jpg",
            image_credit: "Saved Credit",
          },
        ],
      },
      ai_destination_candidates: {
        data: [
          { image_url: "https://cdn.example.com/c.jpg", image_credit: "City" },
        ],
      },
    });

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: null,
        photoAttribution: null,
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual({
      image_url: "https://cdn.example.com/place-photos/saved.jpg",
      image_credit: "Saved Credit",
    });
    expect(from).toHaveBeenCalledWith("places");
    expect(from).not.toHaveBeenCalledWith("ai_destination_candidates");
  });

  it("copies a curated candidate image when no saved place has one", async () => {
    const { queriesByTable } = stubImageQueries({
      places: { data: [] },
      ai_destination_candidates: {
        data: [
          { image_url: "https://cdn.example.com/c.jpg", image_credit: "City" },
        ],
      },
    });

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: null,
        photoAttribution: null,
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual({
      image_url: "https://cdn.example.com/c.jpg",
      image_credit: "City",
    });
    expect(queriesByTable.places.eq).toHaveBeenCalledWith(
      "google_place_id",
      "ChIJabc",
    );
    expect(queriesByTable.ai_destination_candidates.eq).toHaveBeenCalledWith(
      "google_place_id",
      "ChIJabc",
    );
  });

  it("fails soft to no image when both lookups error", async () => {
    stubImageQueries({
      places: { error: { message: "boom" } },
      ai_destination_candidates: { error: { message: "boom" } },
    });

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: null,
        photoAttribution: null,
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual(NO_IMAGE);
  });

  it("fails soft to no image when the Supabase client is unavailable", async () => {
    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error("missing env");
    });

    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: null,
        photoAttribution: null,
        placeId: "ChIJabc",
      }),
    ).resolves.toEqual(NO_IMAGE);
  });

  it("returns no image when there is neither a photo nor a place id", async () => {
    await expect(
      resolvePlaceImage({
        userId: "user-1",
        photoDataUrl: null,
        photoAttribution: null,
        placeId: null,
      }),
    ).resolves.toEqual(NO_IMAGE);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
