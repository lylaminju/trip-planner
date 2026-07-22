import { AI_TRAVEL_MODE_OPTIONS } from "@/lib/ai-planning-preferences";
import type { PlaceSearchBias } from "@/lib/places-api";
import type {
  AiPlanningPreferenceInput,
  TripLodging,
} from "@/lib/types";

import { PlaceSearchField } from "./PlaceSearchField";
import { toggleValue } from "./toggle-value";

export function LogisticsStep({
  currentLodging,
  dailyStartTime,
  destinationBias,
  destinationCountryCodes,
  draft,
  lodgingGoogleMapsUrl,
  onChange,
  onDailyStartTimeChange,
  onLodgingGoogleMapsUrlChange,
  tripId,
}: {
  currentLodging: TripLodging | null;
  dailyStartTime: string;
  destinationBias: PlaceSearchBias | null;
  destinationCountryCodes: string[] | null;
  draft: AiPlanningPreferenceInput;
  lodgingGoogleMapsUrl: string;
  onChange: (draft: AiPlanningPreferenceInput) => void;
  onDailyStartTimeChange: (value: string) => void;
  onLodgingGoogleMapsUrlChange: (value: string) => void;
  tripId: number;
}) {
  const modesEmpty = draft.preferred_travel_modes.length === 0;

  return (
    <div className="ai-logistics-step">
      <div className="ai-field-group">
        <span className="ai-field-label">Travel modes</span>
        <div className="ai-chip-grid">
          {AI_TRAVEL_MODE_OPTIONS.map((option) => {
            const isSelected = draft.preferred_travel_modes.includes(
              option.value,
            );
            return (
              <button
                key={option.value}
                type="button"
                className={isSelected ? "ai-chip selected" : "ai-chip"}
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
        {modesEmpty && (
          <p className="ai-field-error" role="alert">
            Pick at least one way to get around.
          </p>
        )}
      </div>

      <div className="ai-field-row">
        <div className="ai-field-group">
          <span className="ai-field-label">
            Where your days begin
            <span className="ai-field-optional"> — optional</span>
          </span>
          <PlaceSearchField
            tripId={tripId}
            value={lodgingGoogleMapsUrl}
            bias={destinationBias}
            countryCodes={destinationCountryCodes}
            ariaLabel="Where your days begin"
            idleHint="We route each day out from here and back."
            onChange={onLodgingGoogleMapsUrlChange}
          />
        </div>
        <label className="ai-field-group ai-field-time">
          <span className="ai-field-label">Daily start time</span>
          <input
            type="time"
            value={dailyStartTime}
            onChange={(event) =>
              onDailyStartTimeChange(event.currentTarget.value)
            }
          />
        </label>
      </div>

      {currentLodging && (
        <p className="ai-current-lodging">
          Current start point: <strong>{currentLodging.name}</strong>
        </p>
      )}
    </div>
  );
}
