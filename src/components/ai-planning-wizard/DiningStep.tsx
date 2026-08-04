import { AI_DINING_BUDGET_OPTIONS } from "@/lib/ai-planning-preferences";
import type { AiPlanningPreferenceInput } from "@/lib/types";

import { DietaryPreferenceFields } from "../DietaryPreferenceFields";

type Props = {
  draft: AiPlanningPreferenceInput;
  onChange: (draft: AiPlanningPreferenceInput) => void;
};

export function DiningStep({ draft, onChange }: Props) {
  return (
    <div className="ai-dining-step">
      <button
        type="button"
        role="switch"
        aria-checked={draft.include_lunch_stop}
        className={
          draft.include_lunch_stop
            ? "ai-dining-toggle on"
            : "ai-dining-toggle"
        }
        onClick={() =>
          onChange({
            ...draft,
            include_lunch_stop: !draft.include_lunch_stop,
          })
        }
      >
        <span className="ai-dining-toggle-track" aria-hidden="true">
          <span className="ai-dining-toggle-thumb" />
        </span>
        Add a lunch stop to each day
      </button>

      {draft.include_lunch_stop && (
        <>
          <div className="ai-dining-section">
            <span className="ai-dining-section-label">Budget</span>
            <div
              className="ai-chip-grid"
              role="group"
              aria-label="Restaurant budget"
            >
              {AI_DINING_BUDGET_OPTIONS.map((option) => {
                const isSelected = draft.dining_budget === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={isSelected ? "ai-chip selected" : "ai-chip"}
                    aria-pressed={isSelected}
                    onClick={() =>
                      onChange({
                        ...draft,
                        // Tapping the active tier clears it: no tier means
                        // the AI balances price against fit on its own.
                        dining_budget: isSelected ? null : option.value,
                      })
                    }
                  >
                    <span className="ai-chip-emoji" aria-hidden="true">
                      {option.symbol}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ai-dining-section">
            <span className="ai-dining-section-label">
              Food preferences &amp; restrictions
            </span>
            <DietaryPreferenceFields
              tags={draft.dietary_tags}
              notes={draft.dietary_notes ?? ""}
              onTagsChange={(tags) =>
                onChange({ ...draft, dietary_tags: tags })
              }
              onNotesChange={(notes) =>
                onChange({
                  ...draft,
                  dietary_notes: notes === "" ? null : notes,
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
