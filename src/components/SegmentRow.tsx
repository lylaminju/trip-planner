"use client";

import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";
import type { Place, RouteSegment, TravelMode } from "@/lib/types";

const MODES: TravelMode[] = ["walking", "transit", "bicycling", "driving"];

type Props = {
  segment: RouteSegment;
  from: Place;
  to: Place;
  active: boolean;
  onSelect: () => void;
  onModeChange: (mode: TravelMode) => void;
};

export function SegmentRow({
  segment,
  from,
  to,
  active,
  onSelect,
  onModeChange,
}: Props) {
  const url = buildGoogleMapsDirectionsUrl({
    origin: { latitude: from.latitude, longitude: from.longitude },
    destination: { latitude: to.latitude, longitude: to.longitude },
    mode: segment.mode,
  });

  return (
    <div className={`segment-row ${active ? "active" : ""}`} onClick={onSelect}>
      <select
        className="route-mode-select"
        aria-label={`Travel mode from ${from.name} to ${to.name}`}
        value={segment.mode}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) =>
          onModeChange(event.currentTarget.value as TravelMode)
        }
      >
        {MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>
      <a
        className="small-button"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        Open in Google Maps
      </a>
    </div>
  );
}
