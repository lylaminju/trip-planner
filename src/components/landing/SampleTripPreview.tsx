import {
  LandingItineraryStop,
  LandingMobileSheetHandle,
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";

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
            <LandingItineraryStop
              time="10:00"
              name="Brunch cafe"
              note="Late breakfast and coffee"
              markerLabel="1"
              markerColor="#0f766e"
              active
            />
            <LandingRouteSegment mode="walking" duration="18 min" />
            <LandingItineraryStop
              time="11:50"
              name="Museum"
              note="Exhibits and a short gallery loop"
              markerLabel="2"
              markerColor="#0f766e"
            />
            <LandingRouteSegment mode="transit" duration="22 min" />
            <LandingItineraryStop
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
