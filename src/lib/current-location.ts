export type CurrentLocationPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

type WatchableGeolocation = Pick<Geolocation, "watchPosition" | "clearWatch">;

export function startCurrentLocationWatch(
  geolocation: WatchableGeolocation,
  onPosition: (position: CurrentLocationPosition) => void,
  onError: (error: GeolocationPositionError | unknown) => void,
): () => void {
  const watchId = geolocation.watchPosition(
    (position) => {
      onPosition({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      });
    },
    onError,
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    },
  );
  let stopped = false;

  return () => {
    if (stopped) return;

    stopped = true;
    geolocation.clearWatch(watchId);
  };
}
