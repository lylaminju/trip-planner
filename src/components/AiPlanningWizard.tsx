"use client";
import { useEffect, useMemo, useState, type SubmitEvent } from "react";

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
  { key: "interests", label: "Interests", title: "What are you into?" },
  {
    key: "logistics",
    label: "Getting around",
    title: "How will you get around?",
  },
  {
    key: "startend",
    label: "Start & end",
    title: "Where does your trip start and end?",
  },
  { key: "mustsee", label: "Must-sees", title: "Anything you can't miss?" },
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
      ...transitStopPayload(transitDraft),
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
                    <MagicWandIcon />
                  </span>
                  <div>
                    <div id="ai-planning-title" className="ai-wizard-brand-title">
                      Plan with AI
                    </div>
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
                          <MagicWandIcon />
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
