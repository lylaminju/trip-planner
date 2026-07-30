"use client";

import type { RefObject } from "react";

import type { ItineraryDragGeometry } from "@/hooks/useItineraryDrag";
import type { ItineraryItem } from "@/lib/types";

import { ItineraryItemRow } from "./PlaceRows";
import type { DragPreview } from "./drag-schedule";

// The dragged row itself, lifted out of the list and tracking the pointer.
// Its horizontal position is fixed to the column the drag started in, so the
// row only ever travels vertically.
export function DragFloater(props: {
  item: ItineraryItem;
  preview: DragPreview | null;
  markerColor: string;
  geometry: ItineraryDragGeometry;
  floaterRef: RefObject<HTMLDivElement | null>;
}) {
  const previewItem = {
    ...props.item,
    visit_time: floatingVisitTime(props.item, props.preview),
  };

  return (
    <div
      ref={props.floaterRef}
      className="itinerary-drag-floater"
      aria-hidden="true"
      style={{
        left: props.geometry.left,
        top: props.geometry.top,
        width: props.geometry.width,
      }}
    >
      <ItineraryItemRow
        item={previewItem}
        active={false}
        markerLabel={null}
        markerColor={props.markerColor}
        canEdit
        isDeleting={false}
        onSelect={noop}
        onDuplicate={noop}
        onEdit={noop}
        onTimeChange={noop}
        onDelete={noop}
      />
    </div>
  );
}

// The time the row would carry if dropped now, so the floating row previews
// its own result.
function floatingVisitTime(
  item: ItineraryItem,
  preview: DragPreview | null,
): string | null {
  if (preview === null) return item.visit_time;
  if (preview.kind === "day-slot") return preview.visitTime;
  if (preview.kind === "unscheduled") return null;

  return preview.date === item.visit_date ? item.visit_time : null;
}

function noop() {}
