import { describe, expect, it, vi } from "vitest";

import { startCurrentLocationWatch } from "@/lib/current-location";

describe("startCurrentLocationWatch", () => {
  it("maps browser coordinates to a current location position", () => {
    const geolocation = fakeGeolocation();
    const onPosition = vi.fn();

    startCurrentLocationWatch(geolocation, onPosition, vi.fn());
    geolocation.success({
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 12,
      },
    });

    expect(onPosition).toHaveBeenCalledWith({
      lat: 40.7128,
      lng: -74.006,
      accuracy: 12,
    });
  });

  it("clears the created watch exactly once", () => {
    const geolocation = fakeGeolocation(42);
    const stop = startCurrentLocationWatch(geolocation, vi.fn(), vi.fn());

    stop();
    stop();

    expect(geolocation.clearWatch).toHaveBeenCalledTimes(1);
    expect(geolocation.clearWatch).toHaveBeenCalledWith(42);
  });

  it("forwards geolocation errors", () => {
    const geolocation = fakeGeolocation();
    const onError = vi.fn();
    const error = { code: 1, message: "denied" };

    startCurrentLocationWatch(geolocation, vi.fn(), onError);
    geolocation.error(error);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("requests high-accuracy watch options", () => {
    const geolocation = fakeGeolocation();

    startCurrentLocationWatch(geolocation, vi.fn(), vi.fn());

    expect(geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      },
    );
  });
});

type FakePosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
};

function fakeGeolocation(watchId = 7) {
  let successCallback: ((position: FakePosition) => void) | null = null;
  let errorCallback: ((error: unknown) => void) | null = null;

  return {
    watchPosition: vi.fn((success, error) => {
      successCallback = success as (position: FakePosition) => void;
      errorCallback = error as (error: unknown) => void;
      return watchId;
    }),
    clearWatch: vi.fn(),
    success(position: FakePosition) {
      successCallback?.(position);
    },
    error(error: unknown) {
      errorCallback?.(error);
    },
  };
}
