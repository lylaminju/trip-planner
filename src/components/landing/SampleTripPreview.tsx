import {
  BicyclingIcon,
  DrivingIcon,
  ExternalLinkIcon,
  PencilIcon,
  TransitIcon,
  TrashIcon,
  WalkingIcon,
} from "@/components/Icons";
import type { TravelMode } from "@/lib/types";

export function SampleTripPreview() {
  return (
    <section
      className="landing-preview"
      id="sample-trip"
      aria-labelledby="sample-trip-title"
    >
      <div className="landing-preview-copy">
        <p className="landing-section-label">Sample trip</p>
        <h2 id="sample-trip-title">A planner view that matches the map.</h2>
        <p>
          The preview uses the same core pieces as the app: dated visits, route
          segments between visits, and map routes for the selected day.
        </p>
      </div>

      <div
        className="landing-product-frame"
        aria-label="Sample planner and map preview"
      >
        <div className="landing-planner-panel">
          <header className="landing-preview-header">
            <h2>Weekend trip</h2>
          </header>
          <div className="section-heading-row landing-preview-section-row">
            <div className="section-toggle compact">
              <h2>Itineraries</h2>
            </div>
            <div
              className="route-segment-toggle active"
            >
              <span>Route details</span>
              <span className="route-segment-switch-track" aria-hidden="true">
                <span className="route-segment-switch-knob" />
              </span>
            </div>
          </div>
          <div className="day-block landing-day-card">
            <h3 className="day-heading">
              <span className="day-heading-title-group">
                <span
                  className="day-heading-button"
                  style={{ borderColor: "#0f766e" }}
                >
                  <span className="day-heading-prefix">Day 1</span>
                </span>
                <span className="day-collapse-button">
                  <span aria-hidden="true">v</span>
                </span>
              </span>
            </h3>
            <ItineraryStop
              time="10:00"
              name="Brunch cafe"
              note="Late breakfast and coffee"
              markerLabel="1"
              markerColor="#0f766e"
              active
            />
            <RouteSegment mode="walking" duration="18 min" />
            <ItineraryStop
              time="11:50"
              name="Museum"
              note="Exhibits and a short gallery loop"
              markerLabel="2"
              markerColor="#0f766e"
            />
            <RouteSegment mode="transit" duration="22 min" />
            <ItineraryStop
              time="16:30"
              name="Bookstore"
              note="New releases and a few slow laps"
              markerLabel="3"
              markerColor="#0f766e"
            />
          </div>
        </div>

        <div className="landing-map-panel" aria-hidden="true">
          <svg className="landing-map-lines" viewBox="0 0 360 260" role="img">
            <path
              className="landing-map-road"
              d="M32 58 C88 32 114 96 166 76 S246 42 318 76"
            />
            <path
              className="landing-map-road"
              d="M58 202 C116 158 154 214 208 172 S282 130 324 172"
            />
            <path
              className="landing-map-route-halo"
              d="M64 66 C108 98 140 90 178 116"
            />
            <path
              className="landing-map-route-halo"
              d="M178 116 C228 150 254 132 312 168"
            />
            <path
              className="landing-map-route"
              d="M64 66 C108 98 140 90 178 116"
            />
            <path
              className="landing-map-route"
              d="M178 116 C228 150 254 132 312 168"
            />
            <MapPreviewMarker x={64} y={66} label="1" />
            <MapPreviewMarker x={178} y={116} label="2" />
            <MapPreviewMarker x={312} y={168} label="3" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function MapPreviewMarker({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g className="landing-map-marker" transform={`translate(${x} ${y})`}>
      <circle className="landing-map-marker-circle" r="10" />
      <text className="landing-map-marker-label" y="0.5">
        {label}
      </text>
    </g>
  );
}

function ItineraryStop({
  time,
  name,
  note,
  markerLabel,
  markerColor,
  active = false,
}: {
  time: string;
  name: string;
  note: string;
  markerLabel: string;
  markerColor: string;
  active?: boolean;
}) {
  return (
    <div
      className={`place-row landing-itinerary-stop ${active ? "active" : ""}`}
      aria-label={`${time} ${name}`}
    >
      <span className="drag-handle" aria-hidden="true">
        ::
      </span>
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
            <span className="place-time">{time}</span>
            <span className="place-name">{name}</span>
          </span>
        </strong>
        <span className="place-note">{note}</span>
      </div>
      <span className="icon-button" aria-label={`Edit ${name}`}>
        <PencilIcon />
      </span>
      <span
        className="icon-button danger-button"
        aria-label={`Delete ${name}`}
      >
        <TrashIcon />
      </span>
    </div>
  );
}

function RouteSegment({
  mode,
  duration,
}: {
  mode: TravelMode;
  duration: string;
}) {
  const modeOption = getRouteModeOption(mode);

  return (
    <div className="segment-row landing-route-segment">
      <div
        className="route-mode-trigger"
        aria-label={`Travel mode: ${modeOption.label}`}
        title={`Travel mode: ${modeOption.label}`}
      >
        <modeOption.Icon />
        <span className="route-mode-chevron" aria-hidden="true" />
      </div>
      <span className="route-duration">{duration}</span>
      <span
        className="small-button landing-route-map-link"
        aria-label="Open in Google Maps"
      >
        <ExternalLinkIcon />
      </span>
    </div>
  );
}

function getRouteModeOption(mode: TravelMode) {
  switch (mode) {
    case "bicycling":
      return { label: "Bicycling", Icon: BicyclingIcon };
    case "driving":
      return { label: "Driving", Icon: DrivingIcon };
    case "transit":
      return { label: "Transit", Icon: TransitIcon };
    case "walking":
    default:
      return { label: "Walking", Icon: WalkingIcon };
  }
}
