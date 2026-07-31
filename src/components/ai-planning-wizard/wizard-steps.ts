export type AiWizardStepKey =
  | "pace"
  | "logistics"
  | "interests"
  | "startend"
  | "mustsee"
  | "review";

type AiWizardStep = {
  key: AiWizardStepKey;
  label: string;
  title: string;
  helper: string;
  optional?: boolean;
};

// Steps that always carry an answer come first, so every optional step sits in
// one contiguous run before review and "Skip to review" is a single jump.
// Fields that can be left blank belong on an optional step: a required step
// showing an empty search box contradicts its own badge.
export const AI_WIZARD_STEPS: readonly AiWizardStep[] = [
  {
    key: "pace",
    label: "Pace",
    title: "How full should each day feel?",
    helper: "Pick the rhythm that fits — we'll size each day to match.",
  },
  {
    key: "logistics",
    label: "Getting around",
    title: "How will you get around?",
    helper:
      "Choose at least one way to travel, then set when your days start.",
  },
  {
    key: "interests",
    label: "Interests",
    title: "What are you into?",
    helper: "Pick a few and we'll weight your plan toward them.",
    optional: true,
  },
  {
    key: "startend",
    label: "Start & end",
    title: "Where does your trip start and end?",
    helper:
      "Most trips begin and end at an airport, station, or terminal — pick yours, and set where your days begin in between.",
    optional: true,
  },
  {
    key: "mustsee",
    label: "Must-sees",
    title: "Anything you can't miss?",
    helper:
      "Lock in the places you know you want, and we'll build around them.",
    optional: true,
  },
  {
    key: "review",
    label: "Review",
    title: "Review & generate",
    helper: "Here's your plan brief. Edit anything, then let AI build it.",
  },
];

export const AI_WIZARD_LAST_STEP_INDEX = AI_WIZARD_STEPS.length - 1;

/** Steps are addressed by key so reordering them can't silently misroute the
 * review step's Edit links. */
export function aiWizardStepIndex(key: AiWizardStepKey): number {
  return AI_WIZARD_STEPS.findIndex((step) => step.key === key);
}
