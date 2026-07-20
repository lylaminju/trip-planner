"use client";

import type { PlannerResizeHandleProps } from "@/hooks/usePlannerPanelResize";

type Props = {
  handleProps: PlannerResizeHandleProps;
};

export function PlannerResizeHandle(props: Props) {
  return (
    <div
      className="planner-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize planner panel"
      tabIndex={0}
      {...props.handleProps}
    />
  );
}
