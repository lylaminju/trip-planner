export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

export function straightLineDistanceKm(
  from: Coordinates,
  to: Coordinates,
): number {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const halfChordLength =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength))
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
