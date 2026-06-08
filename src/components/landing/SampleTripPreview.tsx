import { ExternalLinkIcon, PencilIcon, TrashIcon } from "@/components/Icons";

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
            <h2>Weekend trip, 4 days</h2>
            <button type="button" className="landing-preview-add">
              Add place
            </button>
          </header>
          <div className="section-heading-row landing-preview-section-row">
            <div className="section-toggle compact">
              <h2>Itineraries</h2>
            </div>
            <button
              type="button"
              className="route-segment-toggle active"
              aria-checked="true"
            >
              <span>Route details</span>
              <span className="route-segment-switch-track" aria-hidden="true">
                <span className="route-segment-switch-knob" />
              </span>
            </button>
          </div>
          <div className="day-block landing-day-card">
            <h3 className="day-heading">
              <span className="day-heading-title-group">
                <button
                  type="button"
                  className="day-heading-button"
                  style={{ borderColor: "#0f766e" }}
                  aria-pressed="true"
                >
                  <span className="day-heading-prefix">Day 2</span>
                  <span className="day-heading-text">Planned day</span>
                </button>
                <button
                  type="button"
                  className="day-collapse-button"
                  aria-label="Collapse Planned day itinerary"
                >
                  <span aria-hidden="true">v</span>
                </button>
              </span>
            </h3>
            <ItineraryStop
              time="09:30"
              name="First stop"
              markerLabel="1"
              markerColor="#0f766e"
              active
            />
            <RouteSegment mode="walking" duration="18 min" />
            <ItineraryStop
              time="11:10"
              name="Lunch stop"
              markerLabel="2"
              markerColor="#0f766e"
            />
            <RouteSegment mode="transit" duration="22 min" />
            <ItineraryStop
              time="14:20"
              name="Afternoon walk"
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
              className="landing-map-route"
              d="M64 66 C108 98 140 90 178 116 C228 150 254 132 312 168"
            />
          </svg>
          <span className="map-marker landing-map-marker landing-map-marker-one">
            1
          </span>
          <span className="map-marker landing-map-marker landing-map-marker-two">
            2
          </span>
          <span className="map-marker landing-map-marker landing-map-marker-three">
            3
          </span>
        </div>
      </div>
    </section>
  );
}

function ItineraryStop({
  time,
  name,
  markerLabel,
  markerColor,
  active = false,
}: {
  time: string;
  name: string;
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
      <button type="button" className="place-main">
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
        <span>Sample address</span>
      </button>
      <button type="button" className="icon-button" aria-label={`Edit ${name}`}>
        <PencilIcon />
      </button>
      <button
        type="button"
        className="icon-button danger-button"
        aria-label={`Delete ${name}`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function RouteSegment({ mode, duration }: { mode: string; duration: string }) {
  return (
    <div className="segment-row landing-route-segment">
      <select
        className="route-mode-select"
        aria-label="Travel mode between sample visits"
        value={mode}
        disabled
      >
        <option value={mode}>{mode}</option>
      </select>
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
