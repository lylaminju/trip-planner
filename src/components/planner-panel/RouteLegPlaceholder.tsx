"use client";

// Stand-in for a route leg a pending drop will create, echoing the real
// segment row's silhouette.
export function RouteLegPlaceholder() {
  return (
    <div className="itinerary-slot-segment-placeholder">
      <span className="itinerary-slot-leg-chip" />
    </div>
  );
}
