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

export function clampMobileSheetHeight(height: number): number {
  if (typeof window === "undefined") return height;

  const minHeight = 42;
  const maxHeight = window.innerHeight;
  return Math.min(Math.max(height, minHeight), maxHeight);
}
