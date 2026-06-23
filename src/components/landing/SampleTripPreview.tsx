import { ChevronRightIcon } from "@/components/Icons";
import {
  LandingItineraryStop,
  LandingMobileSheetHandle,
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import { LandingAbstractMap } from "@/components/landing/LandingAbstractMap";

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
                name="Brunch cafe"
                note="Late breakfast and coffee"
                markerLabel="1"
                markerColor="var(--accent)"
                active
              />
              <LandingRouteSegment mode="walking" duration="18 min" />
              <LandingItineraryStop
                time="11:50"
                name="Museum"
                note="Exhibits and a short gallery loop"
                markerLabel="2"
                markerColor="var(--accent)"
              />
              <LandingRouteSegment mode="transit" duration="22 min" />
              <LandingItineraryStop
                time="16:30"
                name="Bookstore"
                note="New releases and a few slow laps"
                markerLabel="3"
                markerColor="var(--accent)"
              />
            </div>
          </div>

          <div className="landing-map-panel" aria-hidden="true">
            <svg
              className="landing-map-lines"
              preserveAspectRatio="xMidYMid slice"
              viewBox="-100 -80 560 420"
              role="img"
            >
              <g className="landing-map-plane" transform="rotate(-2 180 130)">
                <LandingAbstractMap />
                <path className="landing-map-route-halo" d="M56 44 V146 H177" />
                <path
                  className="landing-map-route-halo"
                  d="M177 146 H281 V242"
                />
                <path className="landing-map-route" d="M56 44 V146 H177" />
                <path className="landing-map-route" d="M177 146 H281 V242" />
                <MapPreviewMarker x={56} y={44} label="1" focused />
                <MapPreviewMarker x={177} y={146} label="2" />
                <MapPreviewMarker x={281} y={242} label="3" />
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
      transform={`translate(${x} ${y})`}
    >
      {focused ? <circle className="landing-map-marker-halo" r="16" /> : null}
      <circle className="landing-map-marker-circle" r={focused ? 12 : 10} />
      <text className="landing-map-marker-label" y="0.5">
        {label}
      </text>
    </g>
  );
}
