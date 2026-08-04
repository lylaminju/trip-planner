"use client";

import {
  AI_DIETARY_NOTES_MAX_LENGTH,
  AI_DIETARY_OPTIONS,
} from "@/lib/ai-planning-preferences";

import { toggleValue } from "./ai-planning-wizard/toggle-value";

// Shown wherever dietary answers are collected: the AI can steer restaurant
// picks but must never be presented as verifying allergen safety.
export const DIETARY_DISCLAIMER =
  "AI suggestions can't verify allergens — always confirm with the restaurant.";

/**
 * Dietary chips plus a free-text catch-all, shared by the profile page
 * (standing defaults) and the AI wizard's dining step (per-trip answers).
 */
export function DietaryPreferenceFields(props: {
  tags: string[];
  notes: string;
  onTagsChange: (tags: string[]) => void;
  onNotesChange: (notes: string) => void;
}) {
  return (
    <div className="dietary-fields">
      <div className="ai-chip-grid">
        {AI_DIETARY_OPTIONS.map((option) => {
          const isSelected = props.tags.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={isSelected ? "ai-chip selected" : "ai-chip"}
              aria-pressed={isSelected}
              onClick={() =>
                props.onTagsChange(toggleValue(props.tags, option.value))
              }
            >
              <span className="ai-chip-emoji" aria-hidden="true">
                {option.emoji}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        className="dietary-notes-input"
        value={props.notes}
        maxLength={AI_DIETARY_NOTES_MAX_LENGTH}
        placeholder="Anything else? e.g. no cilantro, no raw fish"
        aria-label="Other food preferences or restrictions"
        onChange={(event) => props.onNotesChange(event.target.value)}
      />
      <p className="dietary-disclaimer">{DIETARY_DISCLAIMER}</p>
    </div>
  );
}
