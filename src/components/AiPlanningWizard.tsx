"use client";
import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import {
  AI_DEFAULT_DAILY_START_TIME,
  AI_TRAVEL_MODE_OPTIONS,
  buildAiPlanningPreferenceDraft,
  countTripDays,
  formatTripDateRangeShort,
} from "@/lib/ai-planning-preferences";
import type {
  AiPlanningGenerationInput,
  AiPlanningPreferenceInput,
  AiPlanningSetup,
} from "@/lib/types";

import {
  InterestStep,
  LogisticsStep,
  MustSeeStep,
  PaceStep,
  ReviewStep,
} from "./ai-planning-wizard/AiPlanningWizardSteps";
import { CloseIcon } from "./Icons";
import { ModalShell } from "./ModalShell";

type Props = {
  setup: AiPlanningSetup | null;
  isLoading: boolean;
  error: string | null;
  isGenerating: boolean;
  onCancel: () => void;
  onCreateItinerary: (draft: AiPlanningGenerationInput) => void | Promise<void>;
};

const STEP_META = [
  { key: "pace", label: "Pace", title: "How full should each day feel?" },
  { key: "interests", label: "Interests", title: "What are you into?" },
  {
    key: "logistics",
    label: "Getting around",
    title: "How will you get around?",
  },
  { key: "mustsee", label: "Must-sees", title: "Anything you can't miss?" },
  { key: "review", label: "Review", title: "Review & generate" },
] as const;

const STEP_HELPERS: Record<(typeof STEP_META)[number]["key"], string> = {
  pace: "Pick the rhythm that fits — we'll size each day to match.",
  interests: "Optional. Pick a few and we'll weight your plan toward them.",
  logistics:
    "Choose at least one way to travel, then set when your days start and where they begin.",
  mustsee:
    "Optional. Lock in the places you know you want, and we'll build around them.",
  review: "Here's your plan brief. Edit anything, then let AI build it.",
};

const LAST_STEP_INDEX = STEP_META.length - 1;
const STATUS_INTERVAL_MS = 900;

export function AiPlanningWizard(props: Props) {
  const initialDraft = useMemo(
    () => buildAiPlanningPreferenceDraft(props.setup),
    [props.setup],
  );
  const [draft, setDraft] = useState<AiPlanningPreferenceInput>(initialDraft);
  const [dailyStartTime, setDailyStartTime] = useState(
    AI_DEFAULT_DAILY_START_TIME,
  );
  const [lodgingGoogleMapsUrl, setLodgingGoogleMapsUrl] = useState("");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setDraft(initialDraft);
    setDailyStartTime(AI_DEFAULT_DAILY_START_TIME);
    setLodgingGoogleMapsUrl("");
    setStepIndex(0);
  }, [initialDraft]);

  const trip = props.setup?.trip;
  const days =
    trip?.start_date && trip.end_date
      ? countTripDays(trip.start_date, trip.end_date)
      : 0;
  const modesEmpty = draft.preferred_travel_modes.length === 0;
  const isReviewStep = stepIndex === LAST_STEP_INDEX;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReviewStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    props.onCreateItinerary({
      ...draft,
      lodging_google_maps_url:
        lodgingGoogleMapsUrl.trim() === "" ? null : lodgingGoogleMapsUrl.trim(),
      daily_start_time: dailyStartTime || AI_DEFAULT_DAILY_START_TIME,
    });
  }

  function summaryFor(key: (typeof STEP_META)[number]["key"]): string {
    if (key === "pace") {
      return `${compactVisitsRange(draft)} / day`;
    }
    if (key === "interests") {
      return draft.interest_tags.length
        ? `${draft.interest_tags.length} chosen`
        : "Open to any";
    }
    if (key === "logistics") {
      return draft.preferred_travel_modes.length
        ? travelModeLabels(draft).join(", ")
        : "Not set";
    }
    if (key === "mustsee") {
      return draft.must_see_candidate_ids.length
        ? `${draft.must_see_candidate_ids.length} places`
        : "None yet";
    }
    return "Ready when you are";
  }

  return (
    <ModalShell onClose={props.onCancel} className="ai-planning-backdrop">
      <div
        aria-labelledby="ai-planning-title"
        aria-modal="true"
        className="modal ai-planning-modal"
        role="dialog"
      >
        <button
          type="button"
          className="ai-planning-close"
          onClick={props.onCancel}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {props.isLoading && (
          <div className="ai-planning-status" role="status">
            Preparing AI planner…
          </div>
        )}

        {!props.isLoading && props.error && (
          <div className="ai-planning-status ai-planning-status-error">
            <p className="error-text" role="alert">
              {props.error}
            </p>
          </div>
        )}

        {!props.isLoading &&
          !props.error &&
          props.setup &&
          (props.isGenerating ? (
            <AiGenerationScreen
              destination={props.setup.trip.destination}
              days={days}
              paceRange={compactVisitsRange(draft)}
              modeLabels={travelModeLabels(draft)}
            />
          ) : (
            <form className="ai-wizard" onSubmit={submit}>
              <aside className="ai-wizard-rail">
                <div className="ai-wizard-brand">
                  <span className="ai-wizard-brand-icon" aria-hidden="true">
                    <SparkleIcon />
                  </span>
                  <div>
                    <div id="ai-planning-title" className="ai-wizard-brand-title">
                      Plan with AI
                    </div>
                    <div className="ai-wizard-brand-subtitle">Guided setup</div>
                  </div>
                </div>

                <div className="ai-wizard-trip-card">
                  <div className="ai-wizard-trip-name">
                    {props.setup.trip.destination}
                  </div>
                  {trip?.start_date && trip.end_date && (
                    <div className="ai-wizard-trip-dates">
                      {formatTripDateRangeShort(trip.start_date, trip.end_date)}
                    </div>
                  )}
                  {days > 0 && (
                    <span className="ai-wizard-trip-badge">
                      {days} {days === 1 ? "day" : "days"}
                    </span>
                  )}
                </div>

                <ol className="ai-wizard-stepper">
                  {STEP_META.map((step, index) => {
                    const status =
                      index < stepIndex
                        ? "done"
                        : index === stepIndex
                          ? "current"
                          : "todo";
                    return (
                      <li key={step.key} className="ai-wizard-step-item">
                        {index < LAST_STEP_INDEX && (
                          <span
                            aria-hidden="true"
                            className={
                              index < stepIndex
                                ? "ai-wizard-connector done"
                                : "ai-wizard-connector"
                            }
                          />
                        )}
                        <button
                          type="button"
                          className="ai-wizard-step"
                          aria-current={status === "current" ? "step" : undefined}
                          onClick={() => setStepIndex(index)}
                        >
                          <span className={`ai-wizard-dot ${status}`}>
                            {status === "done" ? (
                              <StepCheckIcon />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className="ai-wizard-step-text">
                            <span className={`ai-wizard-step-label ${status}`}>
                              {step.label}
                            </span>
                            <span className={`ai-wizard-step-summary ${status}`}>
                              {summaryFor(step.key)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <p className="ai-wizard-rail-note">
                  Takes about 30 seconds. You can edit every stop afterward.
                </p>
              </aside>

              <div className="ai-wizard-main">
                <div className="ai-wizard-content">
                  <p className="ai-wizard-step-count">
                    Step {stepIndex + 1} of {STEP_META.length}
                  </p>
                  <h2 className="ai-wizard-title">
                    {STEP_META[stepIndex].title}
                  </h2>
                  <p className="ai-wizard-helper">
                    {STEP_HELPERS[STEP_META[stepIndex].key]}
                  </p>

                  {stepIndex === 0 && (
                    <PaceStep draft={draft} onChange={setDraft} days={days} />
                  )}
                  {stepIndex === 1 && (
                    <InterestStep draft={draft} onChange={setDraft} />
                  )}
                  {stepIndex === 2 && (
                    <LogisticsStep
                      currentLodging={props.setup.lodging}
                      dailyStartTime={dailyStartTime}
                      draft={draft}
                      lodgingGoogleMapsUrl={lodgingGoogleMapsUrl}
                      onChange={setDraft}
                      onDailyStartTimeChange={setDailyStartTime}
                      onLodgingGoogleMapsUrlChange={setLodgingGoogleMapsUrl}
                    />
                  )}
                  {stepIndex === 3 && (
                    <MustSeeStep
                      candidates={props.setup.candidates}
                      draft={draft}
                      onChange={setDraft}
                    />
                  )}
                  {isReviewStep && (
                    <ReviewStep
                      candidates={props.setup.candidates}
                      dailyStartTime={dailyStartTime}
                      days={days}
                      draft={draft}
                      onEditStep={setStepIndex}
                    />
                  )}
                </div>

                <footer className="ai-wizard-footer">
                  <button
                    type="button"
                    className="ai-wizard-cancel"
                    onClick={props.onCancel}
                  >
                    Cancel
                  </button>
                  <div className="ai-wizard-nav">
                    {stepIndex > 0 && (
                      <button
                        type="button"
                        className="ai-wizard-back"
                        onClick={() =>
                          setStepIndex((current) => current - 1)
                        }
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="submit"
                      className="ai-wizard-primary"
                      disabled={modesEmpty}
                    >
                      {isReviewStep && (
                        <span
                          className="ai-wizard-primary-icon"
                          aria-hidden="true"
                        >
                          <SparkleIcon />
                        </span>
                      )}
                      {isReviewStep ? "Create itinerary" : "Next"}
                    </button>
                  </div>
                </footer>
              </div>
            </form>
          ))}
      </div>
    </ModalShell>
  );
}

function compactVisitsRange(draft: AiPlanningPreferenceInput): string {
  return draft.visits_per_day_min === draft.visits_per_day_max
    ? `${draft.visits_per_day_max}`
    : `${draft.visits_per_day_min}–${draft.visits_per_day_max}`;
}

function travelModeLabels(draft: AiPlanningPreferenceInput): string[] {
  const map = new Map(
    AI_TRAVEL_MODE_OPTIONS.map((option) => [option.value, option.label]),
  );
  return draft.preferred_travel_modes
    .map((mode) => map.get(mode))
    .filter(Boolean) as string[];
}

function AiGenerationScreen({
  destination,
  days,
  paceRange,
  modeLabels,
}: {
  destination: string;
  days: number;
  paceRange: string;
  modeLabels: string[];
}) {
  const statusMessages = useMemo(
    () => [
      "Reading your preferences…",
      `Mapping must-see spots across ${destination}…`,
      `Balancing ${paceRange} stops a day…`,
      `Optimizing ${
        modeLabels.join(" & ").toLowerCase() || "your"
      } routes…`,
      `Assembling your ${days}-day itinerary…`,
    ],
    [destination, days, paceRange, modeLabels],
  );
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((current) => (current + 1) % statusMessages.length);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [statusMessages.length]);

  return (
    <div
      className="ai-generation-screen"
      role="status"
      aria-label="Creating itinerary"
    >
      <div className="ai-generation-icons" aria-hidden="true">
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M16 28s9-7.4 9-16A9 9 0 0 0 7 12c0 8.6 9 16 9 16Z" />
          <circle cx="16" cy="12" r="3.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M7 22c4.5-8 14-2 18-10" />
          <circle cx="7" cy="22" r="2.5" />
          <circle cx="25" cy="12" r="2.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M9 6v4" />
          <path d="M23 6v4" />
          <path d="M6 10h20v16H6z" />
          <path d="M6 15h20" />
          <path d="m12 21 3 3 6-7" />
        </svg>
      </div>
      <div className="ai-generation-copy">
        <h2 className="ai-generation-title">
          Building your {destination} itinerary
        </h2>
        <p className="ai-generation-status-message">
          {statusMessages[statusIndex]}
        </p>
      </div>
      <div className="ai-generation-bar" aria-hidden="true">
        <span className="ai-generation-bar-fill" />
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l1.7 6.4 6.3 1.7-6.3 1.7L12 21.5 10.3 12.3 4 10.6l6.3-1.7z" />
    </svg>
  );
}

function StepCheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
