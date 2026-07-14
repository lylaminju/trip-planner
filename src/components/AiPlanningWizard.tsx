"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { useResolvedPlaceName } from "@/hooks/useResolvedPlaceName";

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
  MustSeeStep,
  PaceStep,
  ReviewStep,
} from "./ai-planning-wizard/AiPlanningWizardSteps";
import { AiGenerationScreen } from "./ai-planning-wizard/AiGenerationScreen";
import { LogisticsStep } from "./ai-planning-wizard/LogisticsStep";
import { TransitStopsStep } from "./ai-planning-wizard/TransitStopsStep";
import {
  buildTransitStopDraft,
  transitStopPayload,
  transitStopsSummary,
  type TransitStopDraft,
} from "./ai-planning-wizard/transit-stop-draft";
import { CloseIcon, MagicWandIcon } from "./Icons";
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
  {
    key: "interests",
    label: "Interests",
    title: "What are you into?",
    optional: true,
  },
  {
    key: "logistics",
    label: "Getting around",
    title: "How will you get around?",
  },
  {
    key: "startend",
    label: "Start & end",
    title: "Where does your trip start and end?",
    optional: true,
  },
  {
    key: "mustsee",
    label: "Must-sees",
    title: "Anything you can't miss?",
    optional: true,
  },
  { key: "review", label: "Review", title: "Review & generate" },
] as const;

const STEP_HELPERS: Record<(typeof STEP_META)[number]["key"], string> = {
  pace: "Pick the rhythm that fits — we'll size each day to match.",
  interests: "Optional. Pick a few and we'll weight your plan toward them.",
  logistics:
    "Choose at least one way to travel, then set when your days start and where they begin.",
  startend:
    "Optional. Most trips begin and end at an airport, station, or terminal — pick yours and we'll plan around it.",
  mustsee:
    "Optional. Lock in the places you know you want, and we'll build around them.",
  review: "Here's your plan brief. Edit anything, then let AI build it.",
};

const LAST_STEP_INDEX = STEP_META.length - 1;

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
  const [transitDraft, setTransitDraft] = useState<TransitStopDraft>(() =>
    buildTransitStopDraft(props.setup),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const setup = props.setup;
  const formRef = useRef<HTMLFormElement>(null);
  const showStepForm =
    !props.isLoading && !props.error && !!props.setup && !props.isGenerating;

  // ModalShell doesn't trap focus, so on open focus sits on the body and
  // Enter never reaches the form. Pull focus into the form once it's shown so
  // Enter advances even before the user clicks a control.
  useEffect(() => {
    if (showStepForm) {
      formRef.current?.focus();
    }
  }, [showStepForm]);

  useEffect(() => {
    setDraft(initialDraft);
    setDailyStartTime(AI_DEFAULT_DAILY_START_TIME);
    setLodgingGoogleMapsUrl("");
    setTransitDraft(buildTransitStopDraft(setup));
    setStepIndex(0);
  }, [initialDraft, setup]);

  const tripId = props.setup?.trip.id ?? 0;
  const lodgingPreview = useResolvedPlaceName(tripId, lodgingGoogleMapsUrl);
  const lodgingName =
    lodgingGoogleMapsUrl.trim() !== ""
      ? lodgingPreview.status === "resolved"
        ? lodgingPreview.name
        : "From link"
      : (props.setup?.lodging?.name ?? null);
  const arrivalPreview = useResolvedPlaceName(
    tripId,
    transitDraft.arrivalChoice === "custom" ? transitDraft.arrivalUrl : "",
  );
  const departurePreview = useResolvedPlaceName(
    tripId,
    transitDraft.departureChoice === "custom" ? transitDraft.departureUrl : "",
  );

  const trip = props.setup?.trip;
  const days =
    trip?.start_date && trip.end_date
      ? countTripDays(trip.start_date, trip.end_date)
      : 0;
  const modesEmpty = draft.preferred_travel_modes.length === 0;
  const isReviewStep = stepIndex === LAST_STEP_INDEX;
  const currentStep = STEP_META[stepIndex];
  const isOptionalStep = "optional" in currentStep && currentStep.optional;
  const requiresTravelModes =
    currentStep.key === "logistics" || isReviewStep;
  const submitBlocked = modesEmpty && requiresTravelModes;

  function goNext() {
    if (submitBlocked) {
      return;
    }
    if (!isReviewStep) {
      setStepIndex((current) => current + 1);
      return;
    }

    props.onCreateItinerary({
      ...draft,
      lodging_google_maps_url:
        lodgingGoogleMapsUrl.trim() === "" ? null : lodgingGoogleMapsUrl.trim(),
      daily_start_time: dailyStartTime || AI_DEFAULT_DAILY_START_TIME,
      ...transitStopPayload(transitDraft),
    });
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    goNext();
  }

  // Selection chips are buttons, so native Enter re-clicks the focused chip
  // instead of submitting the form. Advance on Enter from anywhere except
  // controls whose own Enter behavior (navigation, cancel, edit) must win.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "textarea, a[href], .ai-wizard-back, .ai-wizard-cancel, " +
          ".ai-wizard-topbar-close, .ai-planning-close, .ai-wizard-step, " +
          ".ai-review-edit",
      )
    ) {
      return;
    }
    event.preventDefault();
    goNext();
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
    if (key === "startend") {
      return transitStopsSummary(transitDraft, props.setup);
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
        {(props.isLoading ||
          props.error ||
          props.isGenerating ||
          !props.setup) && (
          <button
            type="button"
            className="ai-planning-close"
            onClick={props.onCancel}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        )}

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
            <form
              ref={formRef}
              tabIndex={-1}
              className="ai-wizard"
              onSubmit={submit}
              onKeyDown={handleKeyDown}
            >
              <aside className="ai-wizard-rail">
                <div className="ai-wizard-brand">
                  <span className="ai-wizard-brand-icon" aria-hidden="true">
                    <MagicWandIcon />
                  </span>
                  <div className="ai-wizard-brand-text">
                    <div id="ai-planning-title" className="ai-wizard-brand-title">
                      Plan with AI
                    </div>
                    <div className="ai-wizard-brand-sub">
                      {props.setup.trip.destination}
                      {trip?.start_date && trip.end_date
                        ? ` · ${formatTripDateRangeShort(
                            trip.start_date,
                            trip.end_date,
                          )}`
                        : ""}
                    </div>
                  </div>
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
                <div className="ai-wizard-topbar">
                  <button
                    type="button"
                    className="ai-wizard-topbar-close"
                    onClick={props.onCancel}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="ai-wizard-content">
                  <div className="ai-wizard-content-inner">
                  <p className="ai-wizard-step-count">
                    Step {stepIndex + 1} of {STEP_META.length}
                    {isOptionalStep ? " · Optional" : ""}
                  </p>
                  <h2 className="ai-wizard-title">{currentStep.title}</h2>
                  <p className="ai-wizard-helper">
                    {STEP_HELPERS[currentStep.key]}
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
                      tripId={props.setup.trip.id}
                    />
                  )}
                  {stepIndex === 3 && (
                    <TransitStopsStep
                      currentArrivalPoint={props.setup.arrivalPoint}
                      currentDeparturePoint={props.setup.departurePoint}
                      onTransitDraftChange={setTransitDraft}
                      transitDraft={transitDraft}
                      transitHubs={props.setup.transitHubs}
                      tripId={props.setup.trip.id}
                    />
                  )}
                  {stepIndex === 4 && (
                    <MustSeeStep
                      candidates={props.setup.candidates}
                      draft={draft}
                      onChange={setDraft}
                    />
                  )}
                  {isReviewStep && (
                    <ReviewStep
                      arrivalPointName={props.setup.arrivalPoint?.name ?? null}
                      candidates={props.setup.candidates}
                      dailyStartTime={dailyStartTime}
                      days={days}
                      departurePointName={
                        props.setup.departurePoint?.name ?? null
                      }
                      arrivalCustomName={
                        arrivalPreview.status === "resolved"
                          ? arrivalPreview.name
                          : null
                      }
                      departureCustomName={
                        departurePreview.status === "resolved"
                          ? departurePreview.name
                          : null
                      }
                      draft={draft}
                      lodgingName={lodgingName}
                      onEditStep={setStepIndex}
                      transitDraft={transitDraft}
                      transitHubs={props.setup.transitHubs}
                    />
                  )}
                  </div>
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
                      disabled={submitBlocked}
                    >
                      {isReviewStep && (
                        <span
                          className="ai-wizard-primary-icon"
                          aria-hidden="true"
                        >
                          <MagicWandIcon />
                        </span>
                      )}
                      {isReviewStep ? "Create itinerary" : "Next"}
                    </button>
                    <span className="ai-wizard-enter-hint" aria-hidden="true">
                      press <strong>Enter ↵</strong>
                    </span>
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
