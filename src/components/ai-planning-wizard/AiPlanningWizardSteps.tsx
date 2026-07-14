import {
  AI_INTEREST_TAG_OPTIONS,
  AI_PACE_PRESETS,
  AI_TRAVEL_MODE_OPTIONS,
  describePace,
  estimateStopCount,
} from "@/lib/ai-planning-preferences";
import type {
  AiDestinationCandidate,
  AiDestinationTransitHub,
  AiPlanningPreferenceInput,
} from "@/lib/types";

import {
  transitHubChipLabel,
  type TransitStopChoice,
  type TransitStopDraft,
} from "./transit-stop-draft";
import { toggleValue } from "./toggle-value";
import { MapPinIcon } from "../Icons";

type StepProps = {
  draft: AiPlanningPreferenceInput;
  onChange: (draft: AiPlanningPreferenceInput) => void;
};

function CheckIcon() {
  return (
    <svg
      className="ai-check-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PaceStep({
  draft,
  onChange,
  days,
}: StepProps & { days: number }) {
  const stopsEstimate = estimateStopCount(
    draft.visits_per_day_min,
    draft.visits_per_day_max,
    days,
  );

  return (
    <div className="ai-pace-step">
      <div className="ai-pace-grid" role="radiogroup" aria-label="Daily pace">
        {AI_PACE_PRESETS.map((preset) => {
          const isSelected =
            draft.visits_per_day_min === preset.min &&
            draft.visits_per_day_max === preset.max;
          const rangeLabel =
            preset.min === preset.max
              ? `${preset.min} / day`
              : `${preset.min}–${preset.max} / day`;
          return (
            <button
              key={preset.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={isSelected ? "ai-pace-card selected" : "ai-pace-card"}
              onClick={() =>
                onChange({
                  ...draft,
                  visits_per_day_min: preset.min,
                  visits_per_day_max: preset.max,
                })
              }
            >
              <span className="ai-pace-check" aria-hidden="true">
                <CheckIcon />
              </span>
              <span className="ai-pace-dots" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <span
                    key={dot}
                    className={
                      dot >= preset.min && dot <= preset.max
                        ? "ai-pace-dot active"
                        : "ai-pace-dot"
                    }
                  />
                ))}
              </span>
              <span className="ai-pace-label">{preset.label}</span>
              <span className="ai-pace-range">{rangeLabel}</span>
              <span className="ai-pace-descriptor">{preset.descriptor}</span>
            </button>
          );
        })}
      </div>
      <p className="ai-pace-estimate">
        That&apos;s roughly <strong>{stopsEstimate} stops</strong> across your{" "}
        {days} days.
      </p>
    </div>
  );
}

export function InterestStep({ draft, onChange }: StepProps) {
  const count = draft.interest_tags.length;
  return (
    <div className="ai-choice-step">
      <div className="ai-choice-header">
        <span className="ai-choice-count">
          {count > 0
            ? `${count} selected`
            : "Nothing selected — that's fine, we'll keep it broad."}
        </span>
        {count > 0 && (
          <button
            type="button"
            className="ai-choice-clear"
            aria-label="Clear selected interests"
            onClick={() => onChange({ ...draft, interest_tags: [] })}
          >
            Clear
          </button>
        )}
      </div>
      <div className="ai-chip-grid">
        {AI_INTEREST_TAG_OPTIONS.map((option) => {
          const isSelected = draft.interest_tags.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className={isSelected ? "ai-chip selected" : "ai-chip"}
              aria-pressed={isSelected}
              onClick={() =>
                onChange({
                  ...draft,
                  interest_tags: toggleValue(draft.interest_tags, option.value),
                })
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
    </div>
  );
}

export function MustSeeStep({
  candidates,
  draft,
  onChange,
}: StepProps & { candidates: AiDestinationCandidate[] }) {
  const count = draft.must_see_candidate_ids.length;
  return (
    <div className="ai-choice-step">
      <div className="ai-choice-header">
        <span className="ai-choice-count">
          {count > 0
            ? `${count} selected`
            : "None selected — AI will pick the highlights."}
        </span>
        {count > 0 && (
          <button
            type="button"
            className="ai-choice-clear"
            aria-label="Clear selected must-sees"
            onClick={() => onChange({ ...draft, must_see_candidate_ids: [] })}
          >
            Clear
          </button>
        )}
      </div>
      <div className="ai-candidate-list">
        {candidates.map((candidate) => {
          const isSelected = draft.must_see_candidate_ids.includes(
            candidate.id,
          );
          return (
            <button
              key={candidate.id}
              type="button"
              className={
                isSelected ? "ai-candidate-card selected" : "ai-candidate-card"
              }
              aria-pressed={isSelected}
              onClick={() =>
                onChange({
                  ...draft,
                  must_see_candidate_ids: toggleValue(
                    draft.must_see_candidate_ids,
                    candidate.id,
                  ),
                })
              }
            >
              <span className="ai-candidate-thumb">
                {candidate.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage thumbnail; fixed 96×84 box, no next/image domain config needed
                  <img
                    className="ai-candidate-thumb-img"
                    src={candidate.image_url}
                    alt=""
                    loading="lazy"
                    width={104}
                    height={92}
                  />
                ) : (
                  <span
                    className="ai-candidate-thumb-fallback"
                    aria-hidden="true"
                  >
                    <MapPinIcon />
                  </span>
                )}
              </span>
              <span className="ai-candidate-check" aria-hidden="true">
                {isSelected && <CheckIcon />}
              </span>
              <span className="ai-candidate-body">
                <span className="ai-candidate-name">{candidate.name}</span>
                <span className="ai-candidate-meta">
                  {formatCategory(candidate.category)}
                  {candidate.area ? ` · ${candidate.area}` : ""}
                </span>
                {candidate.blurb && (
                  <span className="ai-candidate-blurb">{candidate.blurb}</span>
                )}
                {candidate.planning_note && (
                  <span className="ai-candidate-note">
                    {candidate.planning_note}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewStep({
  arrivalCustomName,
  arrivalPointName,
  draft,
  candidates,
  dailyStartTime,
  days,
  departureCustomName,
  departurePointName,
  lodgingName,
  onEditStep,
  transitDraft,
  transitHubs,
}: {
  arrivalCustomName: string | null;
  arrivalPointName: string | null;
  draft: AiPlanningPreferenceInput;
  candidates: AiDestinationCandidate[];
  dailyStartTime: string;
  days: number;
  departureCustomName: string | null;
  departurePointName: string | null;
  lodgingName: string | null;
  onEditStep: (stepIndex: number) => void;
  transitDraft: TransitStopDraft;
  transitHubs: AiDestinationTransitHub[];
}) {
  const stopsEstimate = estimateStopCount(
    draft.visits_per_day_min,
    draft.visits_per_day_max,
    days,
  );
  const rows = [
    {
      label: "Pace",
      value: `${describePace(draft.visits_per_day_min, draft.visits_per_day_max)} · ~${stopsEstimate} stops total`,
      step: 0,
    },
    {
      label: "Interests",
      value: draft.interest_tags.length
        ? labelsFor(draft.interest_tags, AI_INTEREST_TAG_OPTIONS).join(", ")
        : "Open to anything",
      step: 1,
    },
    {
      label: "Getting around",
      value: draft.preferred_travel_modes.length
        ? labelsFor(
            draft.preferred_travel_modes,
            AI_TRAVEL_MODE_OPTIONS,
          ).join(", ")
        : "Not set",
      step: 2,
    },
    {
      label: "Daily start",
      value: lodgingName
        ? `${lodgingName} · ${dailyStartTime || "09:00"}`
        : dailyStartTime || "09:00",
      step: 2,
    },
    {
      label: "Trip start",
      value: transitStopSummary(
        transitDraft.arrivalChoice,
        transitDraft.arrivalUrl,
        transitDraft.arrivalTime,
        arrivalPointName,
        arrivalCustomName,
        transitHubs,
      ),
      step: 3,
    },
    {
      label: "Trip end",
      value: transitDraft.departureChoice === "same"
        ? withTime("Same as arrival", transitDraft.departureTime)
        : transitStopSummary(
            transitDraft.departureChoice,
            transitDraft.departureUrl,
            transitDraft.departureTime,
            departurePointName,
            departureCustomName,
            transitHubs,
          ),
      step: 3,
    },
    {
      label: "Must-sees",
      value: draft.must_see_candidate_ids.length
        ? mustSeeNames(draft.must_see_candidate_ids, candidates)
        : "None — let AI choose",
      step: 4,
    },
  ];

  return (
    <div className="ai-review-step">
      <div className="ai-review-table">
        {rows.map((row) => (
          <div key={row.label} className="ai-review-row">
            <span className="ai-review-label">{row.label}</span>
            <span className="ai-review-value">{row.value}</span>
            <button
              type="button"
              className="ai-review-edit"
              onClick={() => onEditStep(row.step)}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
      <p className="ai-review-note">
        AI drafts from public info — double-check opening hours before you go.
      </p>
    </div>
  );
}

function transitStopSummary(
  choice: TransitStopChoice,
  url: string,
  time: string,
  savedName: string | null,
  customName: string | null,
  transitHubs: AiDestinationTransitHub[],
): string {
  const selectedHub =
    typeof choice === "number"
      ? transitHubs.find((hub) => hub.id === choice)
      : undefined;
  const name = selectedHub
    ? transitHubChipLabel(selectedHub)
    : choice === "custom" && url.trim() !== ""
      ? (customName ?? "From link")
      : savedName;
  if (!name) return "Not set";
  return withTime(name, time);
}

function withTime(name: string, time: string): string {
  const trimmedTime = time.trim();
  return trimmedTime ? `${name} · ${trimmedTime}` : name;
}

function labelsFor<T extends string | number>(
  values: T[],
  options: readonly { value: T; label: string }[],
): string[] {
  const map = new Map(options.map((option) => [option.value, option.label]));
  return values.map((value) => map.get(value)).filter(Boolean) as string[];
}

function formatCategory(category: string): string {
  return category.replaceAll("_", " ");
}

function mustSeeNames(
  selectedIds: number[],
  candidates: AiDestinationCandidate[],
): string {
  const nameById = new Map(candidates.map((c) => [c.id, c.name]));
  return selectedIds
    .map((id) => nameById.get(id))
    .filter(Boolean)
    .join(", ");
}
