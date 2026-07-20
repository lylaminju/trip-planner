import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  clampPlannerPanelWidth,
  getPlannerPanelWidthStorage,
  PLANNER_PANEL_DEFAULT_WIDTH_PX,
  PLANNER_PANEL_MIN_WIDTH_PX,
  PLANNER_PANEL_RESIZE_STEP_PX,
  readStoredPlannerPanelWidth,
  writeStoredPlannerPanelWidth,
} from "@/lib/planner-panel-width";

export function usePlannerPanelResize() {
  const [width, setWidth] = useState(PLANNER_PANEL_DEFAULT_WIDTH_PX);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartWidthRef = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStoredPlannerPanelWidth(getPlannerPanelWidthStorage());
    if (stored !== null) {
      setWidth(clampPlannerPanelWidth(stored, window.innerWidth));
    }
  }, []);

  function persistWidth(nextWidth: number) {
    writeStoredPlannerPanelWidth(getPlannerPanelWidthStorage(), nextWidth);
  }

  function clearDrag() {
    dragStartXRef.current = null;
    dragStartWidthRef.current = null;
    setIsResizing(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartXRef.current = event.clientX;
    dragStartWidthRef.current = width;
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const startX = dragStartXRef.current;
    const startWidth = dragStartWidthRef.current;
    if (startX === null || startWidth === null) return;

    setWidth(
      clampPlannerPanelWidth(
        startWidth + (event.clientX - startX),
        window.innerWidth,
      ),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const startX = dragStartXRef.current;
    const startWidth = dragStartWidthRef.current;
    clearDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (startX === null || startWidth === null) return;

    const finalWidth = clampPlannerPanelWidth(
      startWidth + (event.clientX - startX),
      window.innerWidth,
    );
    setWidth(finalWidth);
    persistWidth(finalWidth);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const delta =
      event.key === "ArrowLeft"
        ? -PLANNER_PANEL_RESIZE_STEP_PX
        : PLANNER_PANEL_RESIZE_STEP_PX;
    const nextWidth = clampPlannerPanelWidth(width + delta, window.innerWidth);
    setWidth(nextWidth);
    persistWidth(nextWidth);
  }

  return {
    width,
    isResizing,
    handleProps: {
      "aria-valuemin": PLANNER_PANEL_MIN_WIDTH_PX,
      "aria-valuenow": Math.round(width),
      onKeyDown: handleKeyDown,
      onPointerCancel: clearDrag,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}

export type PlannerResizeHandleProps = ReturnType<
  typeof usePlannerPanelResize
>["handleProps"];
