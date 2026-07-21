import { straightLineDistanceKm, type Coordinates } from "@/lib/geo-distance";
import type { TravelMode } from "@/lib/types";

type ChooseAiRouteModeInput = {
  preferredModes: TravelMode[];
  from: Coordinates;
  to: Coordinates;
  canProbeWalking?: boolean;
  getWalkingDurationSeconds?: () => Promise<number | null>;
};

const MAX_WALKING_PROBE_DISTANCE_KM = 2;
const MAX_REASONABLE_WALKING_DURATION_SECONDS = 25 * 60;

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
