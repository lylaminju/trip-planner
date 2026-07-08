import type { CSSProperties } from "react";

import {
  AI_INTEREST_TAG_OPTIONS,
  AI_TRAVEL_MODE_OPTIONS,
  AI_VISITS_PER_DAY_MAX,
  AI_VISITS_PER_DAY_MIN,
  formatVisitsPerDayRangeLabel,
} from "@/lib/ai-planning-preferences";
import type {
  AiDestinationCandidate,
  AiPlanningPreferenceInput,
  TripLodging,
} from "@/lib/types";

type StepProps = {
  draft: AiPlanningPreferenceInput;
  onChange: (draft: AiPlanningPreferenceInput) => void;
};

const VISITS_PER_DAY_TICKS = [1, 2, 3, 4, 5];

export function PaceStep({ draft, onChange }: StepProps) {
  return (
    <fieldset className="ai-wizard-fieldset">
      <legend>Visits per day</legend>
      <div className="ai-visit-range-summary">
        <span>Selected range</span>
        <strong>
          {formatVisitsPerDayRangeLabel(
            draft.visits_per_day_min,
            draft.visits_per_day_max,
          )}
        </strong>
      </div>
      <VisitsPerDayRangeSlider
        minValue={draft.visits_per_day_min}
        maxValue={draft.visits_per_day_max}
        onMinChange={(value) => {
          onChange({
            ...draft,
            visits_per_day_min: Math.min(value, draft.visits_per_day_max),
          });
        }}
        onMaxChange={(value) => {
          onChange({
            ...draft,
            visits_per_day_min: Math.min(draft.visits_per_day_min, value),
            visits_per_day_max: value,
          });
        }}
      />
      <div className="ai-range-ticks" aria-hidden="true">
        {VISITS_PER_DAY_TICKS.map((value) => (
          <span
            key={value}
            className="ai-range-tick"
            style={rangePositionStyle(value)}
          >
            {value}
          </span>
        ))}
      </div>
    </fieldset>
  );
}

export function InterestStep({ draft, onChange }: StepProps) {
  return (
    <fieldset className="ai-wizard-fieldset">
      <legend>Interests</legend>
      <div className="ai-choice-grid">
        {AI_INTEREST_TAG_OPTIONS.map((option) => {
          const isSelected = draft.interest_tags.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={isSelected ? "ai-choice selected" : "ai-choice"}
              aria-pressed={isSelected}
              onClick={() =>
                onChange({
                  ...draft,
                  interest_tags: toggleValue(draft.interest_tags, option.value),
                })
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LogisticsStep({
  currentLodging,
  dailyStartTime,
  draft,
  lodgingGoogleMapsUrl,
  onChange,
  onDailyStartTimeChange,
  onLodgingGoogleMapsUrlChange,
}: StepProps & {
  currentLodging: TripLodging | null;
  dailyStartTime: string;
  lodgingGoogleMapsUrl: string;
  onDailyStartTimeChange: (value: string) => void;
  onLodgingGoogleMapsUrlChange: (value: string) => void;
}) {
  return (
    <fieldset className="ai-wizard-fieldset">
      <legend>Logistics</legend>
      <div className="ai-logistics-section">
        <span className="ai-logistics-label">Preferred travel modes</span>
        <div className="ai-choice-grid">
          {AI_TRAVEL_MODE_OPTIONS.map((option) => {
            const isSelected = draft.preferred_travel_modes.includes(
              option.value,
            );
            return (
              <button
                key={option.value}
                type="button"
                className={isSelected ? "ai-choice selected" : "ai-choice"}
                aria-pressed={isSelected}
                onClick={() =>
                  onChange({
                    ...draft,
                    preferred_travel_modes: toggleValue(
                      draft.preferred_travel_modes,
                      option.value,
                    ),
                  })
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="ai-start-time-field">
        <span>Daily start time</span>
        <input
          type="time"
          value={dailyStartTime}
          onChange={(event) =>
            onDailyStartTimeChange(event.currentTarget.value)
          }
        />
      </label>
      <label className="ai-lodging-url-field">
        <span>Lodging Google Maps URL</span>
        <input
          type="url"
          value={lodgingGoogleMapsUrl}
          placeholder="https://maps.app.goo.gl/..."
          onChange={(event) =>
            onLodgingGoogleMapsUrlChange(event.currentTarget.value)
          }
        />
      </label>
      {currentLodging && (
        <p className="ai-current-lodging">
          Current start point: <strong>{currentLodging.name}</strong>
          {currentLodging.address ? ` - ${currentLodging.address}` : ""}
        </p>
      )}
    </fieldset>
  );
}

export function MustSeeStep({
  candidates,
  draft,
  onChange,
}: StepProps & { candidates: AiDestinationCandidate[] }) {
  return (
    <fieldset className="ai-wizard-fieldset">
      <legend>Must-see attractions</legend>
      <div className="ai-candidate-list">
        {candidates.map((candidate) => {
          const isSelected = draft.must_see_candidate_ids.includes(candidate.id);
          return (
            <label key={candidate.id} className="ai-candidate-option">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() =>
                  onChange({
                    ...draft,
                    must_see_candidate_ids: toggleValue(
                      draft.must_see_candidate_ids,
                      candidate.id,
                    ),
                  })
                }
              />
              <span>
                <strong>{candidate.name}</strong>
                <small>
                  {formatCategory(candidate.category)}
                  {candidate.area ? ` - ${candidate.area}` : ""}
                </small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function VisitsPerDayRangeSlider({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: {
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}) {
  const rangeStyle = {
    "--ai-range-min": `${visitCountPercentage(minValue)}%`,
    "--ai-range-max": `${visitCountPercentage(maxValue)}%`,
  } as CSSProperties;
  const isCollapsed = minValue === maxValue;
  const sliderClassName = [
    "ai-range-slider",
    isCollapsed ? "is-collapsed" : "",
    isCollapsed && minValue === AI_VISITS_PER_DAY_MAX
      ? "is-collapsed-at-max"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={sliderClassName}
      role="group"
      aria-label="Visits per day range"
      style={rangeStyle}
    >
      <div className="ai-range-slider-labels" aria-hidden="true">
        <span>Min {minValue}</span>
        <span>Max {maxValue}</span>
      </div>
      <div className="ai-range-slider-control">
        <div className="ai-range-slider-track" aria-hidden="true">
          <span className="ai-range-slider-selection" />
        </div>
        <input
          className="ai-range-slider-input ai-range-slider-input-min"
          type="range"
          min={AI_VISITS_PER_DAY_MIN}
          max={AI_VISITS_PER_DAY_MAX}
          value={minValue}
          aria-label={`Minimum visits per day, ${minValue}`}
          onChange={(event) => onMinChange(Number(event.currentTarget.value))}
        />
        <input
          className="ai-range-slider-input ai-range-slider-input-max"
          type="range"
          min={AI_VISITS_PER_DAY_MIN}
          max={AI_VISITS_PER_DAY_MAX}
          value={maxValue}
          aria-label={`Maximum visits per day, ${maxValue}`}
          onChange={(event) => onMaxChange(Number(event.currentTarget.value))}
        />
      </div>
    </div>
  );
}

function visitCountPercentage(value: number): number {
  return (
    ((value - AI_VISITS_PER_DAY_MIN) /
      (AI_VISITS_PER_DAY_MAX - AI_VISITS_PER_DAY_MIN)) *
    100
  );
}

function rangePositionStyle(value: number): CSSProperties {
  return {
    "--ai-range-position": `${visitCountPercentage(value)}%`,
  } as CSSProperties;
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function formatCategory(category: string): string {
  return category.replaceAll("_", " ");
}
