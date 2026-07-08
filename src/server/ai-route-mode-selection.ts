import type { TravelMode } from "@/lib/types";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ChooseAiRouteModeInput = {
  preferredModes: TravelMode[];
  from: Coordinates;
  to: Coordinates;
  canProbeWalking?: boolean;
  getWalkingDurationSeconds?: () => Promise<number | null>;
};

const MAX_WALKING_PROBE_DISTANCE_KM = 2;
const MAX_REASONABLE_WALKING_DURATION_SECONDS = 25 * 60;
const EARTH_RADIUS_KM = 6371;

export async function chooseAiRouteMode({
  preferredModes,
  from,
  to,
  canProbeWalking = true,
  getWalkingDurationSeconds,
}: ChooseAiRouteModeInput): Promise<TravelMode> {
  const fallbackMode = preferredModes[0] ?? "walking";
  if (!preferredModes.includes("walking")) {
    return fallbackMode;
  }

  const nonWalkingMode = preferredModes.find((mode) => mode !== "walking");
  if (!nonWalkingMode) {
    return "walking";
  }

  if (straightLineDistanceKm(from, to) > MAX_WALKING_PROBE_DISTANCE_KM) {
    return nonWalkingMode;
  }

  if (!canProbeWalking || !getWalkingDurationSeconds) {
    return nonWalkingMode;
  }

  try {
    const walkingDurationSeconds = await getWalkingDurationSeconds();
    return walkingDurationSeconds !== null &&
      walkingDurationSeconds <= MAX_REASONABLE_WALKING_DURATION_SECONDS
      ? "walking"
      : nonWalkingMode;
  } catch {
    return nonWalkingMode;
  }
}

function straightLineDistanceKm(from: Coordinates, to: Coordinates): number {
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
