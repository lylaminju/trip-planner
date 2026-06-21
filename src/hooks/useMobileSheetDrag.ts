import { useRef, useState, type PointerEvent } from "react";

import {
  clampMobileSheetHeight,
  lowerMobileSheetState,
  nextMobileSheetState,
  raiseMobileSheetState,
  type MobileSheetState,
} from "@/lib/mobile-sheet";

type UseMobileSheetDragInput = {
  state: MobileSheetState;
  onStateChange: (state: MobileSheetState) => void;
};

export function useMobileSheetDrag(input: UseMobileSheetDragInput) {
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  function clearDrag() {
    dragStartYRef.current = null;
    dragStartHeightRef.current = null;
    setDragHeight(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current =
      event.currentTarget.closest(".planner-panel")?.getBoundingClientRect()
        .height ?? null;
    dragMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const startY = dragStartYRef.current;
    const startHeight = dragStartHeightRef.current;
    if (startY === null || startHeight === null) return;

    if (Math.abs(event.clientY - startY) > 8) {
      dragMovedRef.current = true;
    }

    setDragHeight(
      clampMobileSheetHeight(startHeight - (event.clientY - startY)),
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = dragStartYRef.current;
    clearDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (startY === null) return;

    const deltaY = event.clientY - startY;
    if (!dragMovedRef.current || Math.abs(deltaY) < 24) {
      return;
    }

    suppressClickRef.current = true;
    input.onStateChange(
      deltaY > 0
        ? lowerMobileSheetState(input.state)
        : raiseMobileSheetState(input.state),
    );
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    input.onStateChange(nextMobileSheetState(input.state));
  }

  return {
    dragHeight,
    handleClick,
    handlePointerCancel: clearDrag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
