import { AI_TRAVEL_MODE_OPTIONS } from "@/lib/ai-planning-preferences";
import type { AiPlanningPreferenceInput } from "@/lib/types";

import { toggleValue } from "./toggle-value";

export function LogisticsStep({
  dailyStartTime,
  draft,
  onChange,
  onDailyStartTimeChange,
}: {
  dailyStartTime: string;
  draft: AiPlanningPreferenceInput;
  onChange: (draft: AiPlanningPreferenceInput) => void;
  onDailyStartTimeChange: (value: string) => void;
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

      <label className="ai-field-group ai-field-time">
        <span className="ai-field-label">Daily start time</span>
        <input
          type="time"
          value={dailyStartTime}
          onChange={(event) => onDailyStartTimeChange(event.currentTarget.value)}
        />
      </label>
    </div>
  );
}
