import { ChevronRightIcon } from "@/components/Icons";
import {
  LandingItineraryStop,
  LandingMobileSheetHandle,
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import {
  LANDING_MAP_GRID_TRANSFORM,
  LANDING_MAP_UPRIGHT_TRANSFORM,
  LANDING_MAP_VIEW_BOX,
  LandingAbstractMap,
} from "@/components/landing/LandingAbstractMap";

const PREVIEW_ROUTE_LEGS = ["M208 80 V180 H280", "M280 180 V240 H208"];

const PREVIEW_ROUTE_STOPS = [
  { x: 208, y: 80, label: "1", focused: true },
  { x: 280, y: 180, label: "2" },
  { x: 208, y: 240, label: "3" },
];

export function SampleTripPreview() {
  return (
    <section
      className="landing-preview"
      id="planner-preview"
      aria-labelledby="sample-trip-title"
    >
      <h2 id="sample-trip-title" className="sr-only">
        Sample planner preview
      </h2>
      <div className="landing-browser-shell" aria-label="Sample planner preview">
        <div className="landing-browser-chrome" aria-hidden="true">
          <span className="landing-browser-dot" />
          <span className="landing-browser-dot" />
          <span className="landing-browser-dot" />
        </div>

        <div
          className="landing-product-frame"
          aria-label="Sample planner and map preview"
        >
          <div className="landing-planner-panel">
            <LandingMobileSheetHandle />
            <div className="section-heading-row landing-preview-section-row">
              <div className="section-toggle compact">
                <h2>Itineraries</h2>
              </div>
              <LandingRouteDetailsToggle active />
            </div>
            <div className="day-block landing-day-card">
              <h3 className="day-heading">
                <span className="day-heading-title-group">
                  <span className="day-collapse-button" aria-hidden="true">
                    <ChevronRightIcon />
                  </span>
                  <span className="day-heading-button">
                    <span
                      className="day-heading-prefix"
                      style={{ color: "var(--accent)" }}
                    >
                      Day 1
                    </span>
                  </span>
                </span>
              </h3>
              <LandingItineraryStop
                time="10:00"
                name="Airport"
                note="Arrive and collect bags"
                emoji="✈️"
                markerLabel="1"
                markerColor="var(--accent)"
                active
              />
              <LandingRouteSegment mode="walking" duration="18 min" />
              <LandingItineraryStop
                time="11:50"
                name="Hotel"
                note="Check in and drop your bags"
                emoji="🏨"
                markerLabel="2"
                markerColor="var(--accent)"
              />
              <LandingRouteSegment mode="transit" duration="22 min" />
              <LandingItineraryStop
                time="16:30"
                name="Park"
                note="Golden-hour stroll and views"
                emoji="🌳"
                markerLabel="3"
                markerColor="var(--accent)"
              />
            </div>
          </div>

          <div className="landing-map-panel" aria-hidden="true">
            <svg
              className="landing-map-lines"
              preserveAspectRatio="xMidYMid slice"
              viewBox={LANDING_MAP_VIEW_BOX}
              role="img"
            >
              <LandingAbstractMap />
              <g transform={LANDING_MAP_GRID_TRANSFORM}>
                {PREVIEW_ROUTE_LEGS.map((leg) => (
                  <path
                    className="landing-map-route-halo"
                    d={leg}
                    key={`${leg}-halo`}
                  />
                ))}
                {PREVIEW_ROUTE_LEGS.map((leg) => (
                  <path className="landing-map-route" d={leg} key={leg} />
                ))}
                {PREVIEW_ROUTE_STOPS.map((stop) => (
                  <MapPreviewMarker
                    focused={stop.focused}
                    key={stop.label}
                    label={stop.label}
                    x={stop.x}
                    y={stop.y}
                  />
                ))}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapPreviewMarker({
  focused = false,
  x,
  y,
  label,
}: {
  focused?: boolean;
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g
      className={focused ? "landing-map-marker is-focused" : "landing-map-marker"}
      transform={`translate(${x} ${y}) ${LANDING_MAP_UPRIGHT_TRANSFORM}`}
    >
      {focused ? <circle className="landing-map-marker-halo" r="16" /> : null}
      <circle className="landing-map-marker-circle" r={focused ? 12 : 10} />
      <text className="landing-map-marker-label" y="0.5">
        {label}
      </text>
    </g>
  );
}
