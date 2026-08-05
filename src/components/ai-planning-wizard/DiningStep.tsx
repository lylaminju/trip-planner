import { AI_DINING_BUDGET_OPTIONS } from "@/lib/ai-planning-preferences";
import { sendGuestEvent } from "@/lib/guest-api";
import type { AiPlanningPreferenceInput } from "@/lib/types";

import { DietaryPreferenceFields } from "../DietaryPreferenceFields";

const LUNCH_TOGGLE_LABEL = "Add a lunch stop to each day";
const GUEST_LOCKED_NOTE_ID = "ai-dining-guest-locked";

type Props = {
  draft: AiPlanningPreferenceInput;
  onChange: (draft: AiPlanningPreferenceInput) => void;
  // Lunch stops rely on member-only restaurant verification, so guests see the
  // switch locked with a way in rather than a control that plans nothing.
  isGuest?: boolean;
};

export function DiningStep({ draft, onChange, isGuest = false }: Props) {
  if (isGuest) {
    return (
      <div className="ai-dining-step">
        <button
          type="button"
          role="switch"
          aria-checked={false}
          aria-describedby={GUEST_LOCKED_NOTE_ID}
          className="ai-dining-toggle"
          disabled
        >
          <span className="ai-dining-toggle-track" aria-hidden="true">
            <span className="ai-dining-toggle-thumb" />
          </span>
          {LUNCH_TOGGLE_LABEL}
        </button>
        <p className="ai-dining-locked-note" id={GUEST_LOCKED_NOTE_ID}>
          Lunch stops are a member feature.{" "}
          <a
            className="ai-dining-locked-link"
            href="/sign-in"
            onClick={() => sendGuestEvent("upsell_clicked")}
          >
            Sign in
          </a>{" "}
          to add a verified restaurant to each day. The rest of your plan is
          unaffected.
        </p>
      </div>
    );
  }

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
        {LUNCH_TOGGLE_LABEL}
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
            <div className="ai-dining-section-header">
              <span className="ai-dining-section-label">
                Food preferences &amp; restrictions
              </span>
              {/* New tab: mid-wizard navigation would discard the draft. */}
              <a
                className="ai-dining-profile-link"
                href="/profile"
                target="_blank"
                rel="noopener"
              >
                Edit defaults in profile
                <span aria-hidden="true"> ↗</span>
              </a>
            </div>
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
