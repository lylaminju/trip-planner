"use client";

import { useId } from "react";

import { MagicWandIcon } from "./Icons";

export const AI_PLAN_NEEDS_DATES_HINT = "Add trip dates to plan with AI";
export const AI_PLAN_TRIP_TOO_LONG_HINT =
  "AI planning supports trips up to 6 months";

type Props = {
  className: string;
  onPlanWithAi?: () => void;
  mutedHint?: string | null;
};

// One control for both planner surfaces so the header and the map empty state
// cannot drift apart. An owner whose trip is AI-plannable except for one fixable
// gate — missing dates, or a date range past the AI planning cap — still sees
// the button, muted with the gate's hint: the feature stays discoverable and the
// header keeps a stable width when the trip becomes plannable later. The muted
// state is aria-disabled rather than disabled so it stays focusable and
// tappable, which is the only way hover, keyboard, and touch users can all
// reach the reason. Clicking it does nothing; explaining itself is its whole
// job.
export function PlanWithAiButton(props: Props) {
  const hintId = useId();

  if (props.onPlanWithAi) {
    return (
      <button
        type="button"
        className={props.className}
        onClick={props.onPlanWithAi}
      >
        <MagicWandIcon />
        <span>Plan with AI</span>
      </button>
    );
  }

  if (!props.mutedHint) {
    return null;
  }

  return (
    <button
      type="button"
      className={`${props.className} plan-with-ai-muted tooltip-anchor`}
      aria-disabled="true"
      // The hint carries information the label does not, so it is described
      // rather than hidden the way a label-restating tooltip would be. An
      // explicit name keeps the hint text out of the accessible name.
      aria-label="Plan with AI"
      aria-describedby={hintId}
    >
      <MagicWandIcon />
      <span>Plan with AI</span>
      <span className="tooltip tooltip-bottom" id={hintId}>
        {props.mutedHint}
      </span>
    </button>
  );
}
