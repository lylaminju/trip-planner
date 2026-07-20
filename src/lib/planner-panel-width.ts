export const PLANNER_PANEL_MIN_WIDTH_PX = 360;
export const PLANNER_PANEL_DEFAULT_WIDTH_PX = 640;
export const MAP_PANEL_RESERVED_WIDTH_PX = 360;
export const PLANNER_PANEL_RESIZE_STEP_PX = 24;

const PLANNER_PANEL_WIDTH_STORAGE_KEY = "trip-planner:planner-panel-width:v1";

export type PlannerPanelWidthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function getPlannerPanelWidthStorage(): PlannerPanelWidthStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function clampPlannerPanelWidth(
  width: number,
  viewportWidth: number,
): number {
  const maxWidth = Math.max(
    PLANNER_PANEL_MIN_WIDTH_PX,
    viewportWidth - MAP_PANEL_RESERVED_WIDTH_PX,
  );
  return Math.min(Math.max(width, PLANNER_PANEL_MIN_WIDTH_PX), maxWidth);
}

export function readStoredPlannerPanelWidth(
  storage: PlannerPanelWidthStorage | null,
): number | null {
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(PLANNER_PANEL_WIDTH_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null || raw.trim() === "") return null;

  const width = Number(raw);
  if (!Number.isFinite(width) || width < PLANNER_PANEL_MIN_WIDTH_PX) {
    return null;
  }

  return width;
}

export function writeStoredPlannerPanelWidth(
  storage: PlannerPanelWidthStorage | null,
  width: number,
): void {
  if (!storage) return;

  try {
    storage.setItem(PLANNER_PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Persistence is best-effort; ignore storage quota or access errors.
  }
}
