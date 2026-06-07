import { ExternalLinkIcon } from "@/components/Icons";

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
          <p className="landing-trip-name">Weekend trip, 4 days</p>
          <div className="landing-day-card">
            <p className="landing-day-label">Day 2</p>
            <ItineraryStop time="09:30" name="First stop" active />
            <RouteSegment mode="walking" duration="18 min" />
            <ItineraryStop time="11:10" name="Lunch stop" />
            <RouteSegment mode="transit" duration="22 min" />
            <ItineraryStop time="14:20" name="Afternoon walk" />
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
            <circle className="landing-map-marker" cx="64" cy="66" r="10" />
            <circle className="landing-map-marker" cx="178" cy="116" r="10" />
            <circle className="landing-map-marker" cx="312" cy="168" r="10" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function ItineraryStop({
  time,
  name,
  active = false,
}: {
  time: string;
  name: string;
  active?: boolean;
}) {
  return (
    <div
      className={`landing-itinerary-stop ${active ? "active" : ""}`}
      aria-label={`${time} ${name}`}
    >
      <span>{time}</span>
      <strong>{name}</strong>
    </div>
  );
}

function RouteSegment({ mode, duration }: { mode: string; duration: string }) {
  return (
    <div className="landing-route-segment">
      <span className="landing-route-mode">{mode}</span>
      <span>{duration}</span>
      <span className="landing-route-map-link" aria-label="Open in Google Maps">
        <ExternalLinkIcon />
      </span>
    </div>
  );
}
