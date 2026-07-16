"use client";

import { useRef, useState } from "react";

import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";
import type { Place, RouteSegment, TravelMode } from "@/lib/types";
import {
  ArrowUpRightIcon,
  BicyclingIcon,
  DrivingIcon,
  TransitIcon,
  WalkingIcon,
} from "./Icons";

const MODE_OPTIONS: Array<{
  value: TravelMode;
  label: string;
  shortLabel: string;
  Icon: typeof WalkingIcon;
}> = [
  { value: "walking", label: "Walking", shortLabel: "Walk", Icon: WalkingIcon },
  {
    value: "transit",
    label: "Transit",
    shortLabel: "Transit",
    Icon: TransitIcon,
  },
  {
    value: "bicycling",
    label: "Bicycling",
    shortLabel: "Bike",
    Icon: BicyclingIcon,
  },
  {
    value: "driving",
    label: "Driving",
    shortLabel: "Drive",
    Icon: DrivingIcon,
  },
];

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
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [modeMenuPosition, setModeMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedMode = getModeOption(segment.mode);
  const url = buildGoogleMapsDirectionsUrl({
    origin: { latitude: from.latitude, longitude: from.longitude },
    destination: { latitude: to.latitude, longitude: to.longitude },
    mode: segment.mode,
  });

  return (
    <div
      className={`segment-row ${active ? "active" : ""}`}
      data-planner-select
      onClick={onSelect}
    >
      <div
        className="route-mode-picker"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setModeMenuOpen(false);
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          ref={triggerRef}
          className="route-mode-trigger"
          aria-label={`Travel mode: ${selectedMode.label}`}
          aria-haspopup="menu"
          aria-expanded={modeMenuOpen}
          title={`Travel mode: ${selectedMode.label}`}
          disabled={!canEdit}
          onClick={() => {
            if (modeMenuOpen) {
              setModeMenuOpen(false);
              return;
            }

            const triggerBounds = triggerRef.current?.getBoundingClientRect();
            setModeMenuPosition(
              triggerBounds
                ? {
                    left: Math.max(
                      8,
                      Math.min(triggerBounds.left, window.innerWidth - 140),
                    ),
                    top: triggerBounds.bottom + 4,
                  }
                : null,
            );
            setModeMenuOpen(true);
          }}
        >
          <selectedMode.Icon />
          <span className="route-mode-label" aria-hidden="true">
            {selectedMode.shortLabel}
          </span>
          <span className="route-mode-chevron" aria-hidden="true" />
        </button>
        {modeMenuOpen && (
          <div
            className="route-mode-menu"
            role="menu"
            style={
              modeMenuPosition
                ? {
                    left: `${modeMenuPosition.left}px`,
                    top: `${modeMenuPosition.top}px`,
                  }
                : undefined
            }
          >
            {MODE_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={`route-mode-option ${
                  value === segment.mode ? "active" : ""
                }`}
                role="menuitemradio"
                aria-checked={value === segment.mode}
                onClick={() => {
                  setModeMenuOpen(false);
                  if (value !== segment.mode) {
                    onModeChange(value);
                  }
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <span
        className={`route-duration ${
          durationSeconds === undefined ? "placeholder" : ""
        }`}
        aria-hidden={durationSeconds === undefined}
      >
        {durationSeconds === undefined
          ? "9 hr 59 min"
          : formatRouteDuration(durationSeconds)}
      </span>
      <span className="route-segment-actions">
        <a
          className="route-segment-map-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          aria-label="Open in Google Maps"
          title="Open in Google Maps"
        >
          <span className="route-segment-map-label">Maps</span>
          <ArrowUpRightIcon />
        </a>
      </span>
    </div>
  );
}

function getModeOption(mode: TravelMode) {
  return (
    MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[0]
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
