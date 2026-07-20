import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

import {
  parseImageDataUrl,
  storeDestinationPhoto,
  storePlacePhoto,
} from "@/server/destination-photo-service";
import { isValidPlacePhotoName } from "@/server/google-places-search-service";
import { getSupabaseClient } from "@/server/supabase";

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
]).toString("base64")}`;
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]).toString("base64")}`;
// Declared as JPEG but the bytes are not (no FF D8 FF magic).
const WRONG_MAGIC_DATA_URL = `data:image/jpeg;base64,${Buffer.from([
  0x00, 0x01, 0x02, 0x03,
]).toString("base64")}`;

describe("isValidPlacePhotoName", () => {
  it.each([
    "places/ChIJ_abc-123/photos/AeExample_ref-9",
    "places/X/photos/Y",
  ])("accepts a well-formed Place Photo resource name: %s", (name) => {
    expect(isValidPlacePhotoName(name)).toBe(true);
  });

  // Fail closed on anything that is not a Place Photo resource name, so a
  // request-supplied value can never drive an arbitrary upstream fetch.
  it.each([
    "",
    "places/X/photos/",
    "places//photos/Y",
    "photos/X",
    "https://evil.example/x",
    "places/X/photos/Y/media",
    "places/X/photos/Y?maxWidthPx=1",
    "places/X/photos/Y extra",
    "../places/X/photos/Y",
  ])("rejects a malformed value: %s", (name) => {
    expect(isValidPlacePhotoName(name)).toBe(false);
  });
});

describe("parseImageDataUrl", () => {
  it("accepts a JPEG data URL and reports the extension", () => {
    expect(parseImageDataUrl(JPEG_DATA_URL)).toMatchObject({
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("accepts a PNG data URL and reports the extension", () => {
    expect(parseImageDataUrl(PNG_DATA_URL)).toMatchObject({
      contentType: "image/png",
      extension: "png",
    });
  });

  // Fail closed on untrusted bytes: wrong prefix, unsupported type, empty
  // payload, or a declared type whose magic bytes do not match.
  it.each([
    "",
    "not-a-data-url",
    "data:text/plain;base64,aGVsbG8=",
    "data:image/gif;base64,AAAA",
    "data:image/jpeg;base64,",
    WRONG_MAGIC_DATA_URL,
  ])("rejects a malformed or mistyped image: %#", (value) => {
    expect(parseImageDataUrl(value)).toBeNull();
  });
});

describe("photo storage bucket targets", () => {
  const from = vi.fn();

  beforeEach(() => {
    from.mockReset().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi
        .fn()
        .mockReturnValue({ data: { publicUrl: "https://cdn.example.com/x" } }),
    });
    vi.mocked(getSupabaseClient).mockReturnValue({
      storage: { from },
    } as never);
  });

  it("stores destination photos in the trip-destination-photos bucket", async () => {
    await expect(
      storeDestinationPhoto("user-1", JPEG_DATA_URL),
    ).resolves.toBe("https://cdn.example.com/x");
    expect(from).toHaveBeenCalledWith("trip-destination-photos");
  });

  it("stores place photos in the place-photos bucket", async () => {
    await expect(storePlacePhoto("user-1", JPEG_DATA_URL)).resolves.toBe(
      "https://cdn.example.com/x",
    );
    expect(from).toHaveBeenCalledWith("place-photos");
  });

  it("fails soft to null for a rejected image without touching storage", async () => {
    await expect(
      storePlacePhoto("user-1", WRONG_MAGIC_DATA_URL),
    ).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
