import {
  AI_INTEREST_TAG_OPTIONS,
  AI_TRAVEL_MODE_OPTIONS,
  formatVisitsPerDayLabel,
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

export function PaceStep({ draft, onChange }: StepProps) {
  return (
    <fieldset className="ai-wizard-fieldset">
      <legend>Visits per day</legend>
      <div className="ai-visit-range-summary">
        <span>Minimum {draft.visits_per_day_min}</span>
        <strong>{formatVisitsPerDayLabel(draft.visits_per_day_max)}</strong>
      </div>
      <RangeInput
        label="Minimum"
        value={draft.visits_per_day_min}
        onChange={(value) =>
          onChange({
            ...draft,
            visits_per_day_min: Math.min(value, draft.visits_per_day_max),
          })
        }
      />
      <RangeInput
        label="Maximum"
        value={draft.visits_per_day_max}
        onChange={(value) =>
          onChange({
            ...draft,
            visits_per_day_min: Math.min(draft.visits_per_day_min, value),
            visits_per_day_max: value,
          })
        }
      />
      <div className="ai-range-ticks" aria-hidden="true">
        <span>1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
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

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ai-range-control">
      <span>{label}</span>
      <input
        type="range"
        min="1"
        max="4"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function formatCategory(category: string): string {
  return category.replaceAll("_", " ");
}
