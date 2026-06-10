"use client";

import { useState } from "react";

import {
  ExternalLinkIcon,
  PencilIcon,
  PlusIcon,
  TransitIcon,
  TrashIcon,
  WalkingIcon,
} from "@/components/Icons";

type WorkflowStepId = "add-place" | "place-day" | "check-route";

const WORKFLOW_STEPS = [
  {
    id: "add-place",
    title: "Add a Maps place",
    body: "Paste a Google Maps link and keep the place ready for planning.",
    panelTitle: "Add Place",
  },
  {
    id: "place-day",
    title: "Place it on the day",
    body: "Set the visit time, notes, and order without losing map context.",
    panelTitle: "Day 1",
  },
  {
    id: "check-route",
    title: "Check the route",
    body: "Compare route segments and markers before the day gets crowded.",
    panelTitle: "Route details",
  },
] satisfies Array<{
  id: WorkflowStepId;
  title: string;
  body: string;
  panelTitle: string;
}>;

export function LandingFeatureProof() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedStep = WORKFLOW_STEPS[selectedIndex];

  return (
    <section
      className="landing-workflow-proof"
      aria-labelledby="landing-workflow-title"
    >
      <div className="landing-workflow-copy">
        <p className="landing-section-label">How it works</p>
        <h2 id="landing-workflow-title">From saved place to mapped day.</h2>
        <p>
          Follow a place from map link, to itinerary row, to route check without
          switching planning surfaces.
        </p>
      </div>

      <div className="landing-workflow-demo">
        <div
          className="landing-workflow-tabs"
          role="tablist"
          aria-label="TripGlance workflow"
        >
          {WORKFLOW_STEPS.map((step, index) => (
            <button
              aria-controls={`workflow-panel-${step.id}`}
              aria-selected={selectedIndex === index}
              className="landing-workflow-tab"
              id={`workflow-tab-${step.id}`}
              key={step.id}
              onClick={() => setSelectedIndex(index)}
              role="tab"
              type="button"
            >
              <span className="landing-workflow-step-number">{index + 1}</span>
              <span className="landing-workflow-step-copy">
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </span>
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`workflow-tab-${selectedStep.id}`}
          className="landing-workflow-visual"
          id={`workflow-panel-${selectedStep.id}`}
          aria-live="polite"
          role="tabpanel"
        >
          <div className="landing-workflow-visual-header">
            <strong>{selectedStep.panelTitle}</strong>
          </div>

          <div className="landing-workflow-product-frame">
            <WorkflowPlannerState stepId={selectedStep.id} />
            <WorkflowMapState stepId={selectedStep.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowPlannerState({ stepId }: { stepId: WorkflowStepId }) {
  if (stepId === "add-place") {
    return (
      <div className="landing-workflow-planner-panel">
        <div className="landing-workflow-section-row">
          <strong>Places</strong>
        </div>

        <div className="landing-workflow-link-card">
          <span>Google Maps link</span>
          <strong>maps.app.goo.gl/brunch-cafe</strong>
          <div className="landing-workflow-link-action">
            <PlusIcon />
            <span>Add Place</span>
          </div>
        </div>

        <div className="landing-workflow-saved-place">
          <span className="landing-workflow-marker-label">1</span>
          <div>
            <strong>Brunch cafe</strong>
            <span>Place details ready</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-workflow-planner-panel">
      <div className="landing-workflow-section-row">
        <strong>Itineraries</strong>
      </div>

      <div className="landing-workflow-day-card">
        <div className="landing-workflow-day-heading">
          <strong>Day 1</strong>
        </div>

        <WorkflowStop
          time="10:00"
          name="Brunch cafe"
          note="Late breakfast and coffee"
          markerLabel="1"
          active
        />
        {stepId === "check-route" && (
          <WorkflowRoute mode="walking" duration="18 min" active />
        )}
        <WorkflowStop
          time="11:50"
          name="Museum"
          note="Exhibits and a short gallery loop"
          markerLabel="2"
          muted={stepId === "place-day"}
        />
        {stepId === "check-route" && (
          <WorkflowRoute mode="transit" duration="22 min" />
        )}
        {stepId === "check-route" && (
          <WorkflowStop
            time="16:30"
            name="Bookstore"
            note="New releases and a few slow laps"
            markerLabel="3"
          />
        )}
      </div>
    </div>
  );
}

function WorkflowStop({
  time,
  name,
  note,
  markerLabel,
  active = false,
  muted = false,
}: {
  time: string;
  name: string;
  note: string;
  markerLabel: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`landing-workflow-stop ${active ? "active" : ""} ${
        muted ? "muted" : ""
      }`}
      aria-label={`${time} ${name}`}
    >
      <span className="landing-workflow-marker-label">{markerLabel}</span>
      <div className="landing-workflow-stop-main">
        <strong>
          <span>{time}</span>
          <span>{name}</span>
        </strong>
        <span>{note}</span>
      </div>
      <span className="landing-workflow-icon-button" aria-hidden="true">
        <PencilIcon />
      </span>
      <span
        className="landing-workflow-icon-button landing-workflow-danger-button"
        aria-hidden="true"
      >
        <TrashIcon />
      </span>
    </div>
  );
}

function WorkflowRoute({
  mode,
  duration,
  active = false,
}: {
  mode: "transit" | "walking";
  duration: string;
  active?: boolean;
}) {
  const Icon = mode === "walking" ? WalkingIcon : TransitIcon;
  const label = mode === "walking" ? "Walking" : "Transit";

  return (
    <div className={`landing-workflow-route ${active ? "active" : ""}`}>
      <span className="landing-workflow-route-mode" aria-label={label}>
        <Icon />
      </span>
      <span>{duration}</span>
      <span className="landing-workflow-map-link" aria-hidden="true">
        <ExternalLinkIcon />
      </span>
    </div>
  );
}

function WorkflowMapState({ stepId }: { stepId: WorkflowStepId }) {
  const showsSecondMarker = stepId !== "add-place";
  const showsFullRoute = stepId === "check-route";

  return (
    <div className="landing-workflow-map-panel" aria-hidden="true">
      <svg className="landing-workflow-map-lines" viewBox="0 0 360 260">
        <path
          className="landing-workflow-map-road"
          d="M32 58 C88 32 114 96 166 76 S246 42 318 76"
        />
        <path
          className="landing-workflow-map-road"
          d="M58 202 C116 158 154 214 208 172 S282 130 324 172"
        />
        <path
          className={`landing-workflow-map-route-halo ${
            showsFullRoute ? "active" : ""
          }`}
          d="M64 66 C108 98 140 90 178 116"
        />
        {showsFullRoute && (
          <path
            className="landing-workflow-map-route-halo active"
            d="M178 116 C228 150 254 132 312 168"
          />
        )}
        {showsSecondMarker && (
          <path
            className="landing-workflow-map-route"
            d="M64 66 C108 98 140 90 178 116"
          />
        )}
        {showsFullRoute && (
          <path
            className="landing-workflow-map-route"
            d="M178 116 C228 150 254 132 312 168"
          />
        )}
        <WorkflowMapMarker x={64} y={66} label="1" active />
        {showsSecondMarker && <WorkflowMapMarker x={178} y={116} label="2" />}
        {showsFullRoute && <WorkflowMapMarker x={312} y={168} label="3" />}
      </svg>
    </div>
  );
}

function WorkflowMapMarker({
  x,
  y,
  label,
  active = false,
}: {
  x: number;
  y: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g
      className={`landing-workflow-map-marker ${active ? "active" : ""}`}
      transform={`translate(${x} ${y})`}
    >
      <circle className="landing-workflow-map-marker-circle" r="10" />
      <text className="landing-workflow-map-marker-label" y="0.5">
        {label}
      </text>
    </g>
  );
}
