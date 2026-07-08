"use client";

import { useEffect, useMemo, useState, type SubmitEvent } from "react";

import {
  AI_DEFAULT_DAILY_START_TIME,
  buildAiPlanningPreferenceDraft,
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

const STEPS = ["Pace", "Interests", "Logistics", "Must-see"] as const;

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

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stepIndex < STEPS.length - 1) {
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

  return (
    <ModalShell onClose={props.onCancel}>
      <form
        aria-labelledby="ai-planning-title"
        aria-modal="true"
        className="modal ai-planning-modal"
        role="dialog"
        onSubmit={submit}
      >
        <header className="modal-header">
          <div>
            <h2 id="ai-planning-title">Plan with AI</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={props.onCancel}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>

        {props.isLoading && (
          <div className="ai-planning-loading" role="status">
            Preparing AI planner...
          </div>
        )}

        {!props.isLoading && props.error && (
          <p className="error-text" role="alert">
            {props.error}
          </p>
        )}

        {!props.isLoading &&
          !props.error &&
          props.setup &&
          (props.isGenerating ? (
            <AiGenerationLoadingIcons />
          ) : (
            <>
              <nav className="ai-wizard-steps" aria-label="AI planning steps">
                {STEPS.map((step, index) => (
                  <span
                    key={step}
                    className={
                      index === stepIndex
                        ? "ai-wizard-step current"
                        : "ai-wizard-step"
                    }
                  >
                    {step}
                  </span>
                ))}
              </nav>

              <section className="ai-wizard-step-panel">
                <p className="ai-wizard-step-count">
                  Step {stepIndex + 1} of {STEPS.length}
                </p>
                {stepIndex === 0 && (
                  <PaceStep draft={draft} onChange={setDraft} />
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
              </section>
            </>
          ))}

        <footer className="modal-actions ai-planning-actions">
          <button
            type="button"
            disabled={props.isGenerating}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          {!props.isLoading && !props.error && props.setup && (
            <div className="ai-planning-step-actions">
              {stepIndex > 0 && (
                <button
                  type="button"
                  disabled={props.isGenerating}
                  onClick={() => setStepIndex((current) => current - 1)}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                className="ai-planning-primary-action"
                disabled={
                  props.isGenerating ||
                  draft.preferred_travel_modes.length === 0
                }
              >
                {stepIndex === STEPS.length - 1 ? "Create itinerary" : "Next"}
              </button>
            </div>
          )}
        </footer>
      </form>
    </ModalShell>
  );
}

function AiGenerationLoadingIcons() {
  return (
    <div
      className="ai-generation-loading"
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
    </div>
  );
}
