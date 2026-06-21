export type MobileSheetState = "collapsed" | "half" | "full";

export function nextMobileSheetState(
  state: MobileSheetState,
): MobileSheetState {
  if (state === "collapsed") return "half";
  if (state === "half") return "full";
  return "collapsed";
}

export function lowerMobileSheetState(
  state: MobileSheetState,
): MobileSheetState {
  if (state === "full") return "half";
  return "collapsed";
}

export function raiseMobileSheetState(
  state: MobileSheetState,
): MobileSheetState {
  if (state === "collapsed") return "half";
  return "full";
}

type MobileSheetReleaseInput = {
  state: MobileSheetState;
  deltaY: number;
  dragMoved: boolean;
};

export function resolveMobileSheetReleaseState(
  input: MobileSheetReleaseInput,
): MobileSheetState {
  if (!input.dragMoved || Math.abs(input.deltaY) < 24) {
    return nextMobileSheetState(input.state);
  }

  return input.deltaY > 0
    ? lowerMobileSheetState(input.state)
    : raiseMobileSheetState(input.state);
}

export function clampMobileSheetHeight(height: number): number {
  if (typeof window === "undefined") return height;

  const minHeight = 40;
  const maxHeight = window.innerHeight;
  return Math.min(Math.max(height, minHeight), maxHeight);
}
