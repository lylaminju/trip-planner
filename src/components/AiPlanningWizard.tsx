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
  AI_CREATE_ITINERARY_LABEL,
  AI_DEFAULT_DAILY_START_TIME,
  AI_TRAVEL_MODE_OPTIONS,
  buildAiPlanningPreferenceDraft,
  countTripDays,
  formatTripDateRangeShort,
} from "@/lib/ai-planning-preferences";
import type {
  AiCatalogPrepStatus,
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
import {
  AI_WIZARD_LAST_STEP_INDEX,
  AI_WIZARD_STEPS,
  aiWizardStepIndex,
  type AiWizardStepKey,
} from "./ai-planning-wizard/wizard-steps";
import { CloseIcon, MagicWandIcon } from "./Icons";
import { ModalShell } from "./ModalShell";

type Props = {
  setup: AiPlanningSetup | null;
  isLoading: boolean;
  // Background preparation of the destination's attractions and transit hubs;
  // the dependent steps render their own pending/error states.
  catalogStatus: AiCatalogPrepStatus;
  hubsStatus: AiCatalogPrepStatus;
  onRetryCatalogPrepare: () => void;
  error: string | null;
  isGenerating: boolean;
  // Guests can't run live place search (the places routes are user-only), so
  // the location fields fall back to pasting a Google Maps link.
  isGuest?: boolean;
  onCancel: () => void;
  onCreateItinerary: (draft: AiPlanningGenerationInput) => void | Promise<void>;
  onRetryLoad: () => void;
};

export function AiPlanningWizard(props: Props) {
  const initialDraft = useMemo(
    () => buildAiPlanningPreferenceDraft(props.setup),
    [props.setup],
  );
  const [draft, setDraft] = useState<AiPlanningPreferenceInput>(initialDraft);
  const [lodgingGoogleMapsUrl, setLodgingGoogleMapsUrl] = useState("");
  const [transitDraft, setTransitDraft] = useState<TransitStopDraft>(() =>
    buildTransitStopDraft(props.setup),
  );
  const [stepIndex, setStepIndex] = useState(0);
  const setup = props.setup;
  const formRef = useRef<HTMLFormElement>(null);
  const showStepForm =
    !props.isLoading && !!props.setup && !props.isGenerating;

  // ModalShell doesn't trap focus, so on open focus sits on the body and
  // Enter never reaches the form. Pull focus into the form once it's shown so
  // Enter advances even before the user clicks a control.
  useEffect(() => {
    if (showStepForm) {
      formRef.current?.focus();
    }
  }, [showStepForm]);

  // Initialize the drafts from the first setup only. The setup object updates
  // again when background catalog/hub preparation lands, and that must not
  // reset the user's in-progress answers or step position. (A fresh open
  // remounts the wizard, so the ref starts false again.)
  const hasInitializedFromSetupRef = useRef(false);
  useEffect(() => {
    if (!setup || hasInitializedFromSetupRef.current) return;
    hasInitializedFromSetupRef.current = true;
    setDraft(buildAiPlanningPreferenceDraft(setup));
    setLodgingGoogleMapsUrl("");
    setTransitDraft(buildTransitStopDraft(setup));
    setStepIndex(0);
  }, [setup]);

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
  // Preset and custom trips both store their destination coordinates and
  // country, so bias and restrict place search straight from the columns: the
  // bias ranks results near the destination, the country codes keep a generic
  // query like "hotel" from surfacing places in far-off countries.
  const destinationBias =
    trip?.destination_latitude != null && trip.destination_longitude != null
      ? {
          latitude: trip.destination_latitude,
          longitude: trip.destination_longitude,
        }
      : null;
  const destinationCountryCodes = trip?.destination_country_codes ?? null;
  const modesEmpty = draft.preferred_travel_modes.length === 0;
  const isReviewStep = stepIndex === AI_WIZARD_LAST_STEP_INDEX;
  const currentStep = AI_WIZARD_STEPS[stepIndex];
  const isOptionalStep = currentStep.optional === true;
  const requiresTravelModes =
    currentStep.key === "logistics" || isReviewStep;
  // Generation validates against catalog candidate IDs server-side, so the
  // final submit must wait for the background catalog preparation.
  const catalogPending = props.catalogStatus !== "ready";
  const submitBlocked =
    (modesEmpty && requiresTravelModes) || (isReviewStep && catalogPending);

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
      // The time input clears to "" when the user wipes it; the saved
      // preference must still be a real HH:MM.
      daily_start_time: draft.daily_start_time || AI_DEFAULT_DAILY_START_TIME,
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
          ".ai-review-edit, .ai-wizard-skip",
      )
    ) {
      return;
    }
    event.preventDefault();
    goNext();
  }

  function summaryFor(key: AiWizardStepKey): string {
    if (key === "pace") {
      return `${compactVisitsRange(draft)} / day`;
    }
    if (key === "interests") {
      const parts = [];
      if (draft.interest_tags.length) {
        parts.push(`${draft.interest_tags.length} chosen`);
      }
      if (draft.avoid_interest_tags.length) {
        parts.push(`${draft.avoid_interest_tags.length} skipped`);
      }
      return parts.length ? parts.join(" · ") : "Open to any";
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
        {(props.isLoading || props.isGenerating || !props.setup) && (
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

        {!props.isLoading && props.error && !props.setup && (
          <div className="ai-planning-status ai-planning-status-error">
            <p className="error-text" role="alert">
              {props.error}
            </p>
            <button
              type="button"
              className="ai-wizard-primary"
              onClick={props.onRetryLoad}
            >
              Try again
            </button>
          </div>
        )}

        {!props.isLoading &&
          props.setup &&
          (props.isGenerating ? (
            <AiGenerationScreen
              destination={props.setup.trip.destination}
              candidates={props.setup.candidates}
              selectedIds={draft.must_see_candidate_ids}
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
                      <span className="ai-wizard-brand-destination">
                        {props.setup.trip.destination}
                      </span>
                      {trip?.start_date && trip.end_date && (
                        <span className="ai-wizard-brand-dates">
                          {formatTripDateRangeShort(
                            trip.start_date,
                            trip.end_date,
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <ol className="ai-wizard-stepper">
                  {AI_WIZARD_STEPS.map((step, index) => {
                    const status =
                      index < stepIndex
                        ? "done"
                        : index === stepIndex
                          ? "current"
                          : "todo";
                    return (
                      <li key={step.key} className="ai-wizard-step-item">
                        {index < AI_WIZARD_LAST_STEP_INDEX && (
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
                  You can edit every stop afterward.
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
                  <div className="ai-wizard-eyebrow">
                    <p
                      className={
                        isOptionalStep
                          ? "ai-wizard-step-count optional"
                          : "ai-wizard-step-count"
                      }
                    >
                      <span className="ai-wizard-step-count-index">
                        Step {stepIndex + 1} of {AI_WIZARD_STEPS.length}
                      </span>
                      {isOptionalStep && (
                        <span className="ai-wizard-step-count-optional">
                          Optional
                        </span>
                      )}
                    </p>
                    {isOptionalStep && (
                      <button
                        type="button"
                        className="ai-wizard-skip"
                        onClick={() =>
                          setStepIndex(AI_WIZARD_LAST_STEP_INDEX)
                        }
                      >
                        Skip to review
                        <span aria-hidden="true"> →</span>
                      </button>
                    )}
                  </div>
                  <h2 className="ai-wizard-title">{currentStep.title}</h2>
                  <p className="ai-wizard-helper">{currentStep.helper}</p>

                  {currentStep.key === "pace" && (
                    <PaceStep
                      draft={draft}
                      onChange={setDraft}
                      days={days}
                      candidateCount={props.setup.candidates.length}
                    />
                  )}
                  {currentStep.key === "logistics" && (
                    <LogisticsStep
                      dailyStartTime={draft.daily_start_time}
                      draft={draft}
                      onChange={setDraft}
                      onDailyStartTimeChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          daily_start_time: value,
                        }))
                      }
                    />
                  )}
                  {currentStep.key === "interests" && (
                    <InterestStep draft={draft} onChange={setDraft} />
                  )}
                  {currentStep.key === "startend" && (
                    <TransitStopsStep
                      currentArrivalPoint={props.setup.arrivalPoint}
                      currentDeparturePoint={props.setup.departurePoint}
                      currentLodging={props.setup.lodging}
                      destinationBias={destinationBias}
                      destinationCountryCodes={destinationCountryCodes}
                      hubsStatus={props.hubsStatus}
                      isGuest={props.isGuest ?? false}
                      lodgingGoogleMapsUrl={lodgingGoogleMapsUrl}
                      onLodgingGoogleMapsUrlChange={setLodgingGoogleMapsUrl}
                      onRetryPrepare={props.onRetryCatalogPrepare}
                      onTransitDraftChange={setTransitDraft}
                      transitDraft={transitDraft}
                      transitHubs={props.setup.transitHubs}
                      tripId={props.setup.trip.id}
                    />
                  )}
                  {currentStep.key === "mustsee" && (
                    <MustSeeStep
                      candidates={props.setup.candidates}
                      catalogStatus={props.catalogStatus}
                      onRetryPrepare={props.onRetryCatalogPrepare}
                      draft={draft}
                      onChange={setDraft}
                    />
                  )}
                  {isReviewStep && (
                    <ReviewStep
                      arrivalPointName={props.setup.arrivalPoint?.name ?? null}
                      candidates={props.setup.candidates}
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
                      onEditStep={(key) => setStepIndex(aiWizardStepIndex(key))}
                      transitDraft={transitDraft}
                      transitHubs={props.setup.transitHubs}
                    />
                  )}
                  </div>
                </div>

                {isReviewStep && props.error && (
                  <p className="ai-wizard-error" role="alert">
                    {props.error}
                  </p>
                )}
                {isReviewStep && props.catalogStatus === "error" && (
                  <p className="ai-wizard-error" role="alert">
                    Couldn&apos;t prepare this destination&apos;s attractions.{" "}
                    <button
                      type="button"
                      className="ai-step-retry"
                      onClick={props.onRetryCatalogPrepare}
                    >
                      Try again
                    </button>
                  </p>
                )}

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
                      {isReviewStep
                        ? props.error
                          ? "Try again"
                          : catalogPending
                            ? "Preparing destination…"
                            : AI_CREATE_ITINERARY_LABEL
                        : "Next"}
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
