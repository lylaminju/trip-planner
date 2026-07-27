import { ChevronRightIcon } from "@/components/Icons";
import {
  LandingItineraryStop,
  LandingMobileSheetHandle,
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import { LANDING_PLACE_PHOTOS } from "@/components/landing/preview-place-photos";
const PREVIEW_MAP_SRC = "/landing-preview-map.webp";
const PREVIEW_MAP_WIDTH = 1400;
const PREVIEW_MAP_HEIGHT = 1030;

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
                time="09:20"
                name="Bryant Park"
                note="Easy first stop in Midtown"
                photo={LANDING_PLACE_PHOTOS.bryantPark}
                markerLabel="1"
                markerColor="var(--accent)"
                active
              />
              <LandingRouteSegment mode="walking" duration="10 min" />
              <LandingItineraryStop
                time="10:20"
                name="Times Square"
                note="Short walk from the park"
                photo={LANDING_PLACE_PHOTOS.timesSquare}
                markerLabel="2"
                markerColor="var(--accent)"
              />
              <LandingRouteSegment mode="walking" duration="15 min" />
              <LandingItineraryStop
                time="11:20"
                name="Grand Central Terminal"
                note="Open 24/7 as a terminal"
                photo={LANDING_PLACE_PHOTOS.grandCentral}
                markerLabel="3"
                markerColor="var(--accent)"
              />
            </div>
          </div>

          <div className="landing-map-panel" aria-hidden="true">
            <img
              className="landing-map-image"
              src={PREVIEW_MAP_SRC}
              alt=""
              width={PREVIEW_MAP_WIDTH}
              height={PREVIEW_MAP_HEIGHT}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
