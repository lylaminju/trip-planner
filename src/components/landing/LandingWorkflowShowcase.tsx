"use client";

import { useState, type ReactNode } from "react";

import {
  ArrowUpRightIcon,
  BicyclingIcon,
  ChevronRightIcon,
  DrivingIcon,
  TransitIcon,
  WalkingIcon,
} from "@/components/Icons";
import {
  LandingItineraryStop,
  LandingPlaceListRow,
} from "@/components/landing/LandingPlannerRows";
import { LANDING_PLACE_PHOTOS } from "@/components/landing/preview-place-photos";

const WORKFLOW_MAP_SRC = "/landing-workflow-map.webp";
const WORKFLOW_MAP_WIDTH = 900;
const WORKFLOW_MAP_HEIGHT = 880;

type WorkflowStep = {
  id: "plan" | "map" | "route";
  tabLabel: string;
  title: string;
  description: string;
  points: string[];
  Visual: () => ReactNode;
};

export const LANDING_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "plan",
    tabLabel: "Plan by day",
    title: "A plan that arranges itself.",
    description:
      "Drag a saved place onto any day and it slots into place. Timed stops stay sorted first, with unscheduled places ready below.",
    points: [
      "Group visits into date buckets automatically",
      "Keep unscheduled places visible",
      "Reorder by dragging, or move between days",
    ],
    Visual: LandingWorkflowPlanByDayVisual,
  },
  {
    id: "map",
    tabLabel: "See the map",
    title: "Every stop, on one map.",
    description:
      "Scheduled visits appear as numbered markers that match your itinerary. Focus the map from a day or stop while unscheduled places stay separate.",
    points: [
      "Numbered markers matched to each day",
      "Focus the map from any day or place",
      "Live route lines drawn between timed stops",
    ],
    Visual: LandingWorkflowMapVisual,
  },
  {
    id: "route",
    tabLabel: "Time your routes",
    title: "Know the time between stops.",
    description:
      "Consecutive timed visits create a route segment with real travel duration. Switch modes from the icon menu, then open the external Google Maps route web page for full directions.",
    points: [
      "Icon menu for walking, transit, cycling, or driving",
      "Durations from Google Maps route data",
      "Open the external Google Maps route web page",
    ],
    Visual: LandingWorkflowRouteTimeVisual,
  },
];

export function LandingWorkflowShowcase() {
  const [activeId, setActiveId] = useState<WorkflowStep["id"]>("plan");
  const activeStep =
    LANDING_WORKFLOW_STEPS.find((step) => step.id === activeId) ??
    LANDING_WORKFLOW_STEPS[0];
  const ActiveVisual = activeStep.Visual;

  return (
    <section
      className="landing-workflow-section"
      id="showcase"
      aria-labelledby="landing-workflow-title"
    >
      <div className="landing-workflow-heading">
        <p className="landing-section-label">How it works</p>
        <h2 id="landing-workflow-title">
          From a list of places to a plan you can follow.
        </h2>
      </div>

      <div className="landing-workflow-tabs" aria-label="Workflow views">
        {LANDING_WORKFLOW_STEPS.map((step) => (
          <button
            aria-pressed={step.id === activeId}
            className="landing-workflow-tab"
            key={step.id}
            onClick={() => setActiveId(step.id)}
            type="button"
          >
            {step.tabLabel}
          </button>
        ))}
      </div>

      <div className="landing-workflow-card">
        <div className="landing-workflow-copy">
          <h3>{activeStep.title}</h3>
          <p>{activeStep.description}</p>
          <ul className="landing-workflow-points">
            {activeStep.points.map((point) => (
              <li key={point}>
                <span className="landing-workflow-check" aria-hidden="true">
                  <svg viewBox="0 0 12 12" focusable="false">
                    <path d="M3 6.2 5 8.2 9 3.8" />
                  </svg>
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-workflow-visual">
          <ActiveVisual />
        </div>
      </div>
    </section>
  );
}

export function LandingWorkflowPlanByDayVisual() {
  return (
    <div className="landing-workflow-product-frame landing-workflow-plan-card">
      <div className="day-block landing-day-card landing-workflow-day-card">
        <h3 className="day-heading">
          <span className="day-heading-title-group">
            <span className="day-collapse-button" aria-hidden="true">
              <ChevronRightIcon />
            </span>
            <span className="day-heading-button">
              <span
                className="day-heading-prefix"
                style={{ color: "var(--accent)" }}
              >
                Day 1
              </span>
            </span>
          </span>
        </h3>
        <LandingItineraryStop
          time="09:30"
          name="Times Square"
          photo={LANDING_PLACE_PHOTOS.timesSquare}
          markerLabel="1"
          markerColor="var(--accent)"
          active
        />
        <LandingItineraryStop
          time="11:00"
          name="Bryant Park"
          photo={LANDING_PLACE_PHOTOS.bryantPark}
          markerLabel="2"
          markerColor="var(--accent)"
        />
      </div>
      <div className="unscheduled-block landing-workflow-unscheduled-block">
        <div className="section-toggle">
          <span
            className="section-toggle-button"
            aria-expanded="true"
            aria-hidden="true"
          >
            <ChevronRightIcon />
          </span>
          <h3>Unscheduled</h3>
        </div>
        <LandingPlaceListRow
          name="Central Park"
          photo={LANDING_PLACE_PHOTOS.centralPark}
        />
      </div>
    </div>
  );
}

export function LandingWorkflowMapVisual() {
  return (
    <div className="landing-workflow-map-card">
      <img
        className="landing-workflow-map-image"
        src={WORKFLOW_MAP_SRC}
        alt="Map preview"
        width={WORKFLOW_MAP_WIDTH}
        height={WORKFLOW_MAP_HEIGHT}
      />
    </div>
  );
}

export function LandingWorkflowRouteTimeVisual() {
  return (
    <div className="landing-workflow-product-frame landing-workflow-route-card">
      <LandingItineraryStop
        time="09:30"
        name="Bryant Park"
        note="Easy first stop in Midtown"
        photo={LANDING_PLACE_PHOTOS.bryantPark}
        markerLabel="1"
        markerColor="var(--accent)"
      />
      <div className="segment-row landing-route-segment landing-workflow-open-route-segment active">
        <div className="route-mode-picker">
          <span
            className="route-mode-trigger"
            aria-label="Travel mode: Walking"
            aria-expanded="true"
            title="Travel mode: Walking"
          >
            <WalkingIcon />
            <span className="route-mode-label" aria-hidden="true">
              Walk
            </span>
            <span className="route-mode-chevron" aria-hidden="true" />
          </span>
          <div className="route-mode-menu landing-workflow-route-mode-menu">
            <RouteModeOption label="Walking" Icon={WalkingIcon} active />
            <RouteModeOption label="Transit" Icon={TransitIcon} />
            <RouteModeOption label="Bicycling" Icon={BicyclingIcon} />
            <RouteModeOption label="Driving" Icon={DrivingIcon} />
          </div>
        </div>
        <span className="route-duration">12 min</span>
        <span className="route-segment-actions">
          <span
            className="route-segment-map-link"
            aria-label="Open route in Google Maps"
            title="Open route in Google Maps"
          >
            <span className="route-segment-map-label">Maps</span>
            <ArrowUpRightIcon />
          </span>
        </span>
      </div>
      <LandingItineraryStop
        time="11:00"
        name="Grand Central"
        note="Open 24/7 as a terminal"
        photo={LANDING_PLACE_PHOTOS.grandCentral}
        markerLabel="2"
        markerColor="var(--accent)"
      />
    </div>
  );
}

function RouteModeOption({
  label,
  Icon,
  active = false,
}: {
  label: string;
  Icon: typeof WalkingIcon;
  active?: boolean;
}) {
  return (
    <span className={active ? "route-mode-option active" : "route-mode-option"}>
      <Icon />
      <span>{label}</span>
    </span>
  );
}
