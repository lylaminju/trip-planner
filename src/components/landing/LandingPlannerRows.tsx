import {
  ArrowUpRightIcon,
  BicyclingIcon,
  CalendarPlusIcon,
  DrivingIcon,
  PencilIcon,
  TransitIcon,
  TrashIcon,
  WalkingIcon,
} from "@/components/Icons";
import type { TravelMode } from "@/lib/types";

type LandingItineraryStopProps = {
  time: string;
  name: string;
  note?: string;
  emoji?: string;
  markerLabel: string;
  markerColor: string;
  active?: boolean;
};

export function LandingItineraryStop({
  time,
  name,
  note,
  emoji,
  markerLabel,
  markerColor,
  active = false,
}: LandingItineraryStopProps) {
  const rowClassName = active
    ? "place-row landing-itinerary-stop active"
    : "place-row landing-itinerary-stop";

  return (
    <div className={rowClassName} aria-label={`${time} ${name}`}>
      <span className="drag-handle" aria-hidden="true">
        ::
      </span>
      <span className="landing-stop-time" aria-hidden="true">
        {time}
      </span>
      {emoji ? (
        <span className="landing-stop-thumb" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      <div className="place-main">
        <strong className="place-title">
          <span
            className="place-marker-label"
            style={{ backgroundColor: markerColor }}
            aria-label={`Visit order ${markerLabel}`}
          >
            {markerLabel}
          </span>
          <span className="place-title-text">
            <span className="place-name">{name}</span>
          </span>
        </strong>
        {note ? <span className="place-note">{note}</span> : null}
      </div>
      <span className="icon-button" aria-label={`Edit ${name}`}>
        <PencilIcon />
      </span>
      <span className="icon-button danger-button" aria-label={`Delete ${name}`}>
        <TrashIcon />
      </span>
    </div>
  );
}

type LandingRouteSegmentProps = {
  mode: TravelMode;
  duration: string;
};

type LandingPlaceListRowProps = {
  name: string;
  detail?: string;
  emoji?: string;
};

export function LandingPlaceListRow({
  name,
  detail,
  emoji,
}: LandingPlaceListRowProps) {
  return (
    <div className="place-row landing-itinerary-stop" aria-label={name}>
      {emoji ? (
        <span className="landing-stop-thumb" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      <div className="place-main">
        <strong className="place-title">
          <span className="place-title-text">
            <span className="place-name">{name}</span>
          </span>
        </strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <span className="icon-button" aria-label={`Add ${name} to itinerary`}>
        <CalendarPlusIcon />
      </span>
      <span className="icon-button" aria-label={`Edit place ${name}`}>
        <PencilIcon />
      </span>
      <span
        className="icon-button danger-button"
        aria-label={`Delete place ${name}`}
      >
        <TrashIcon />
      </span>
    </div>
  );
}

export function LandingMobileSheetHandle() {
  return (
    <div className="mobile-sheet-handle landing-preview-sheet-handle">
      <span aria-hidden="true" />
    </div>
  );
}

export function LandingRouteSegment({
  mode,
  duration,
}: LandingRouteSegmentProps) {
  const modeOption = getRouteModeOption(mode);

  return (
    <div className="segment-row landing-route-segment">
      <div className="route-mode-picker">
        <span
          className="route-mode-trigger"
          aria-label={`Travel mode: ${modeOption.label}`}
          title={`Travel mode: ${modeOption.label}`}
        >
          <modeOption.Icon />
          <span className="route-mode-label" aria-hidden="true">
            {modeOption.shortLabel}
          </span>
          <span className="route-mode-chevron" aria-hidden="true" />
        </span>
      </div>
      <span className="route-duration">{duration}</span>
      <span className="route-segment-actions">
        <span
          className="route-segment-map-link"
          aria-label="Open route in Google Maps"
          title="Open route in Google Maps"
        >
          <span className="route-segment-map-label">Maps</span>
          <ArrowUpRightIcon />
        </span>
      </span>
    </div>
  );
}

export function LandingRouteDetailsToggle({ active }: { active: boolean }) {
  const className = active
    ? "route-segment-toggle active"
    : "route-segment-toggle";

  return (
    <button
      aria-checked={active}
      className={className}
      role="switch"
      title={`${active ? "Hide" : "Show"} route segments`}
      type="button"
    >
      <span>Route legs</span>
      <span className="route-segment-switch-track" aria-hidden="true">
        <span className="route-segment-switch-knob" />
      </span>
    </button>
  );
}

function getRouteModeOption(mode: TravelMode) {
  switch (mode) {
    case "bicycling":
      return { label: "Bicycling", shortLabel: "Bike", Icon: BicyclingIcon };
    case "driving":
      return { label: "Driving", shortLabel: "Drive", Icon: DrivingIcon };
    case "transit":
      return { label: "Transit", shortLabel: "Transit", Icon: TransitIcon };
    case "walking":
    default:
      return { label: "Walking", shortLabel: "Walk", Icon: WalkingIcon };
  }
}
