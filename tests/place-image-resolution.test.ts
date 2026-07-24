import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/destination-photo-service", () => ({
  storePlacePhoto: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

import { storePlacePhoto } from "@/server/destination-photo-service";
import {
  findReusablePlace,
  resolvePlaceImage,
} from "@/server/place-image-resolution";
import { getSupabaseClient } from "@/server/supabase";

const NO_IMAGE = { image_url: null, image_credit: null };

type ImageRow = {
  // `name` only ever appears on curated candidate rows; saved places expose
  // `google_place_name` instead.
  name?: string | null;
  google_place_name?: string | null;
  image_url: string | null;
  image_credit: string | null;
};
type TableResult = { data?: ImageRow[]; error?: { message: string } };

function stubImageQueries(resultsByTable: Record<string, TableResult>) {
  const queriesByTable: Record<
    string,
    { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> }
  > = {};
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? {};
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
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

describe("findReusablePlace", () => {
  beforeEach(() => {
    vi.mocked(getSupabaseClient).mockReset();
  });

  // `places.name` is user-authored and this lookup has no trip or account
  // scope, so a saved row must never hand it to whoever picks the same place
  // id. Only `google_place_name`, which holds Google's canonical name, and the
  // image may be shared from that table.
  it("reuses a saved place's canonical name, never the user's own", async () => {
    const { queriesByTable } = stubImageQueries({
      places: {
        data: [
          {
            google_place_name: "Empire State Building",
            image_url: "https://cdn.example.com/place-photos/saved.jpg",
            image_credit: "Jane Doe",
          } as ImageRow,
        ],
      },
    });

    await expect(findReusablePlace("ChIJabc")).resolves.toEqual({
      name: "Empire State Building",
      image_url: "https://cdn.example.com/place-photos/saved.jpg",
      image_credit: "Jane Doe",
    });
    // `name` is not even requested, so a future edit here cannot leak it.
    expect(queriesByTable.places.select).toHaveBeenCalledWith(
      "google_place_name, image_url, image_credit",
    );
  });

  // Rows saved before the canonical name existed still spare the Place Photo
  // call; only the name falls back to a billed lookup.
  it("returns the image with no name when the canonical name is unknown", async () => {
    stubImageQueries({
      places: {
        data: [
          {
            google_place_name: null,
            image_url: "https://cdn.example.com/place-photos/saved.jpg",
            image_credit: "Jane Doe",
          } as ImageRow,
        ],
      },
    });

    await expect(findReusablePlace("ChIJabc")).resolves.toEqual({
      name: null,
      image_url: "https://cdn.example.com/place-photos/saved.jpg",
      image_credit: "Jane Doe",
    });
  });

  // Curated candidates are seeded content, not user text, so their name is safe
  // and spares a billed Place Details lookup.
  it("reuses a curated candidate's name", async () => {
    stubImageQueries({
      places: { data: [] },
      ai_destination_candidates: {
        data: [
          {
            name: "Empire State Building",
            image_url: "https://cdn.example.com/candidates/esb.jpg",
            image_credit: "Curated",
          } as ImageRow,
        ],
      },
    });

    await expect(findReusablePlace("ChIJabc")).resolves.toEqual({
      name: "Empire State Building",
      image_url: "https://cdn.example.com/candidates/esb.jpg",
      image_credit: "Curated",
    });
  });
});
