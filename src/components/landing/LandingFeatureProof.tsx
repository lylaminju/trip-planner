"use client";

import { useState } from "react";

import { PlusIcon } from "@/components/Icons";
import { LandingAbstractMap } from "@/components/landing/LandingAbstractMap";
import {
  LandingItineraryStop,
  LandingMobileSheetHandle,
  LandingPlaceListRow,
  LandingRouteDetailsToggle,
  LandingRouteSegment,
} from "@/components/landing/LandingPlannerRows";

type WorkflowStepId = "add-place" | "place-day" | "check-route";

const WORKFLOW_STEPS = [
  {
    id: "add-place",
    title: "Add a Maps place",
    body: "Paste a Google Maps link and keep the place ready for planning.",
  },
  {
    id: "place-day",
    title: "Place it on the day",
    body: "Set the visit time, notes, and order without losing map context.",
  },
  {
    id: "check-route",
    title: "Check the route",
    body: "Compare route segments and markers before the day gets crowded.",
  },
] satisfies Array<{
  id: WorkflowStepId;
  title: string;
  body: string;
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
          className="landing-workflow-product-frame"
          id={`workflow-panel-${selectedStep.id}`}
          aria-live="polite"
          role="tabpanel"
        >
          <WorkflowPlannerState stepId={selectedStep.id} />
          <WorkflowMapState stepId={selectedStep.id} />
        </div>
      </div>
    </section>
  );
}

function WorkflowPlannerState({ stepId }: { stepId: WorkflowStepId }) {
  if (stepId === "add-place") {
    return (
      <div className="landing-workflow-planner-panel">
        <LandingMobileSheetHandle />
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

        <LandingPlaceListRow name="Brunch cafe" detail="Place details ready" />
      </div>
    );
  }

  return (
    <div className="landing-workflow-planner-panel">
      <LandingMobileSheetHandle />
      <div className="section-heading-row landing-preview-section-row landing-workflow-section-row">
        <div className="section-toggle compact">
          <h2>Itineraries</h2>
        </div>
        <LandingRouteDetailsToggle active={stepId === "check-route"} />
      </div>

      <div className="day-block landing-day-card">
        <h3 className="day-heading">
          <span className="day-heading-title-group">
            <span
              className="day-heading-button"
              style={{ borderColor: "#0f766e" }}
            >
              <span className="day-heading-prefix">Day 1</span>
            </span>
            <span className="day-collapse-button">
              <span aria-hidden="true">v</span>
            </span>
          </span>
        </h3>

        <LandingItineraryStop
          time="10:00"
          name="Brunch cafe"
          note="Late breakfast and coffee"
          markerLabel="1"
          markerColor="#0f766e"
          active
        />
        {stepId === "check-route" && (
          <LandingRouteSegment mode="walking" duration="18 min" />
        )}
        <LandingItineraryStop
          time="11:50"
          name="Museum"
          note="Exhibits and a short gallery loop"
          markerLabel="2"
          markerColor="#0f766e"
        />
        {stepId === "check-route" && (
          <LandingRouteSegment mode="transit" duration="22 min" />
        )}
        {stepId === "check-route" && (
          <LandingItineraryStop
            time="16:30"
            name="Bookstore"
            note="New releases and a few slow laps"
            markerLabel="3"
            markerColor="#0f766e"
          />
        )}
      </div>
    </div>
  );
}

function WorkflowMapState({ stepId }: { stepId: WorkflowStepId }) {
  const showsSecondMarker = stepId !== "add-place";
  const showsFullRoute = stepId === "check-route";

  return (
    <div className="landing-workflow-map-panel" aria-hidden="true">
      <svg
        className="landing-workflow-map-lines"
        preserveAspectRatio="xMidYMid slice"
        viewBox="-100 -80 560 420"
      >
        <g className="landing-map-plane" transform="rotate(-2 180 130)">
          <LandingAbstractMap />
          <path
            className={`landing-workflow-map-route-halo ${
              showsFullRoute ? "active" : ""
            }`}
            d="M56 44 V146 H177"
          />
          {showsFullRoute && (
            <path
              className="landing-workflow-map-route-halo active"
              d="M177 146 H281 V242"
            />
          )}
          {showsSecondMarker && (
            <path className="landing-workflow-map-route" d="M56 44 V146 H177" />
          )}
          {showsFullRoute && (
            <path
              className="landing-workflow-map-route"
              d="M177 146 H281 V242"
            />
          )}
          <WorkflowMapMarker x={56} y={44} label="1" active />
          {showsSecondMarker && <WorkflowMapMarker x={177} y={146} label="2" />}
          {showsFullRoute && <WorkflowMapMarker x={281} y={242} label="3" />}
        </g>
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
