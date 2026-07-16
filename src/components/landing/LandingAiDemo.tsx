import { ChevronRightIcon, MagicWandIcon } from "@/components/Icons";
import {
  LandingItineraryStop,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";
import {
  AI_CREATE_ITINERARY_LABEL,
  AI_INTEREST_TAG_OPTIONS,
  AI_PACE_PRESETS,
  AI_TRAVEL_MODE_OPTIONS,
  countTripDays,
  formatTripDateRangeShort,
  formatVisitsPerDayRangeLabel,
} from "@/lib/ai-planning-preferences";
import { formatItineraryDateHeading } from "@/lib/place-display";
import type { TravelMode } from "@/lib/types";

const DEMO_DESTINATION = "New York City";
const DEMO_START_DATE = "2026-04-03";
const DEMO_END_DATE = "2026-04-06";
const DEMO_PACE_LABEL = "Balanced";
const DEMO_INTEREST_TAGS: string[] = ["landmarks", "museums", "nature"];
const DEMO_TRAVEL_MODES: TravelMode[] = ["walking", "transit"];

const DEMO_PACE =
  AI_PACE_PRESETS.find((preset) => preset.label === DEMO_PACE_LABEL) ??
  AI_PACE_PRESETS[0];

export function LandingAiDemo() {
  return (
    <section
      className="landing-ai-demo-section"
      id="ai-planner"
      aria-labelledby="landing-ai-demo-title"
    >
      <div className="landing-ai-demo-heading">
        <p className="landing-section-label">AI planner</p>
        <h2 id="landing-ai-demo-title">
          Answer a few questions, get a dated plan.
        </h2>
      </div>

      <div className="landing-ai-demo-flow">
        <LandingAiSetupCard />
        <span className="landing-ai-demo-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 12" focusable="false">
            <path d="M0 6 H21 M16 1.5 L21.5 6 L16 10.5" />
          </svg>
        </span>
        <LandingAiDraftCard />
      </div>
    </section>
  );
}

function LandingAiSetupCard() {
  const days = countTripDays(DEMO_START_DATE, DEMO_END_DATE);
  const dateRange = formatTripDateRangeShort(DEMO_START_DATE, DEMO_END_DATE);

  return (
    <div
      className="landing-ai-setup-card"
      aria-label="AI planning setup preview"
    >
      <div className="landing-ai-setup-head">
        <strong className="landing-ai-setup-destination">
          {DEMO_DESTINATION}
        </strong>
        <span className="landing-ai-setup-dates">
          {dateRange} · {days} days
        </span>
      </div>

      <div className="landing-ai-setup-field">
        <p className="landing-ai-setup-legend">Pace</p>
        <div className="landing-ai-pace-row">
          {AI_PACE_PRESETS.map((preset) => (
            <span
              className={
                preset.label === DEMO_PACE_LABEL
                  ? "landing-ai-pace-option is-selected"
                  : "landing-ai-pace-option"
              }
              key={preset.label}
            >
              {preset.label}
            </span>
          ))}
        </div>
        <p className="landing-ai-pace-descriptor">
          {DEMO_PACE.descriptor}{" "}
          <span className="landing-ai-pace-range">
            {formatVisitsPerDayRangeLabel(DEMO_PACE.min, DEMO_PACE.max)}
          </span>
        </p>
      </div>

      <div className="landing-ai-setup-field">
        <p className="landing-ai-setup-legend">Interests</p>
        <div className="landing-ai-chip-row">
          {AI_INTEREST_TAG_OPTIONS.map((option) => (
            <LandingAiChip
              emoji={option.emoji}
              key={option.value}
              label={option.label}
              selected={DEMO_INTEREST_TAGS.includes(option.value)}
            />
          ))}
        </div>
      </div>

      <div className="landing-ai-setup-field">
        <p className="landing-ai-setup-legend">Getting around</p>
        <div className="landing-ai-chip-row">
          {AI_TRAVEL_MODE_OPTIONS.map((option) => (
            <LandingAiChip
              key={option.value}
              label={option.label}
              selected={DEMO_TRAVEL_MODES.includes(option.value)}
            />
          ))}
        </div>
      </div>

      <span className="landing-ai-generate-button">
        <MagicWandIcon />
        {AI_CREATE_ITINERARY_LABEL}
      </span>
    </div>
  );
}

function LandingAiChip({
  emoji,
  label,
  selected,
}: {
  emoji?: string;
  label: string;
  selected: boolean;
}) {
  return (
    <span className={selected ? "landing-ai-chip is-selected" : "landing-ai-chip"}>
      {emoji ? (
        <span className="landing-ai-chip-emoji" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      {label}
    </span>
  );
}

function LandingAiDraftCard() {
  return (
    <div
      className="landing-workflow-product-frame landing-ai-draft-card"
      aria-label="AI draft itinerary preview"
    >
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
              <span className="day-heading-text">
                {formatItineraryDateHeading(DEMO_START_DATE)}
              </span>
            </span>
          </span>
        </h3>

        <LandingItineraryStop
          time="09:00"
          name="Central Park"
          markerLabel="1"
          markerColor="var(--accent)"
        />
        <LandingRouteSegment mode="walking" duration="12 min" />
        <LandingItineraryStop
          time="11:30"
          name="Museum of Modern Art"
          markerLabel="2"
          markerColor="var(--accent)"
        />
        <LandingRouteSegment mode="transit" duration="18 min" />
        <LandingItineraryStop
          time="15:00"
          name="The High Line"
          markerLabel="3"
          markerColor="var(--accent)"
        />
      </div>
    </div>
  );
}
