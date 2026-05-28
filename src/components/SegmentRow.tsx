"use client";

import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";
import type { Place, RouteSegment, TravelMode } from "@/lib/types";
import { ExternalLinkIcon } from "./Icons";

const MODES: TravelMode[] = ["walking", "transit", "bicycling", "driving"];

type Props = {
  segment: RouteSegment;
  from: Place;
  to: Place;
  active: boolean;
  durationSeconds?: number;
  canEdit: boolean;
  onSelect: () => void;
  onModeChange: (mode: TravelMode) => void;
};

export function SegmentRow({
  segment,
  from,
  to,
  active,
  durationSeconds,
  canEdit,
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
        disabled={!canEdit}
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
      {durationSeconds !== undefined && (
        <span className="route-duration">
          {formatRouteDuration(durationSeconds)}
        </span>
      )}
      <a
        className="small-button"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        title="Open in Google Maps"
      >
        <ExternalLinkIcon />
      </a>
    </div>
  );
}

function formatRouteDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}
