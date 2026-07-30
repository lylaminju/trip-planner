"use client";

import { RouteLegPlaceholder } from "./RouteLegPlaceholder";

// In-flow gap marking where the dragged visit will land, sized to the row
// that was lifted out, with stand-ins for the route legs the drop will
// create. Takes its full height immediately and never animates: the hovered
// slot is resolved by measuring the live rows, so a slot whose height is
// still moving would resolve differently as it moved.
export function InsertionPlaceholder(props: {
  height: number;
  showLegAbove: boolean;
  showLegBelow: boolean;
}) {
  return (
    <div className="itinerary-slot-placeholder" aria-hidden="true">
      {props.showLegAbove && <RouteLegPlaceholder />}
      <div className="itinerary-slot-gap" style={{ height: props.height }} />
      {props.showLegBelow && <RouteLegPlaceholder />}
    </div>
  );
}
