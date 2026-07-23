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
          name="Airport"
          emoji="✈️"
          markerLabel="1"
          markerColor="var(--accent)"
          active
        />
        <LandingItineraryStop
          time="11:00"
          name="Hotel"
          emoji="🏨"
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
        <LandingPlaceListRow name="Park" emoji="🌳" />
      </div>
    </div>
  );
}

export function LandingWorkflowMapVisual() {
  return (
    <div className="landing-workflow-map-card">
      <svg
        viewBox="0 0 100 78"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Map preview"
      >
        <rect className="landing-workflow-map-ground" width="100" height="78" />
        <path
          className="landing-workflow-map-water"
          d="M0 60 C20 56 36 64 55 60 C72 56 84 57 100 62 L100 78 L0 78 Z"
        />
        <g className="landing-workflow-map-blocks">
          <rect
            className="landing-workflow-map-block is-muted"
            x="5"
            y="7"
            width="20"
            height="13"
            rx="2.4"
          />
          <rect
            className="landing-workflow-map-block"
            x="33"
            y="5"
            width="17"
            height="15"
            rx="2.4"
          />
          <rect
            className="landing-workflow-map-block is-park"
            x="58"
            y="8"
            width="25"
            height="18"
            rx="3"
          />
          <rect
            className="landing-workflow-map-block"
            x="10"
            y="30"
            width="18"
            height="14"
            rx="2.4"
          />
          <rect
            className="landing-workflow-map-block is-muted"
            x="39"
            y="35"
            width="16"
            height="12"
            rx="2.4"
          />
          <rect
            className="landing-workflow-map-block is-park"
            x="72"
            y="39"
            width="18"
            height="15"
            rx="3"
          />
        </g>
        <path className="landing-workflow-map-road" d="M0 25 H100" />
        <path className="landing-workflow-map-road is-thin" d="M0 48 H100" />
        <path className="landing-workflow-map-road" d="M30 0 V64" />
        <path className="landing-workflow-map-road is-thin" d="M56 0 V64" />
        <path className="landing-workflow-map-road is-thin" d="M86 0 V64" />
        <path
          className="landing-workflow-map-road is-angled"
          d="M-4 58 C18 45 31 39 43 27 C54 16 70 10 104 9"
        />
        <rect
          className="landing-workflow-map-place-card"
          x="63"
          y="28"
          width="21"
          height="9"
          rx="3"
        />
        <path
          className="landing-workflow-map-route-halo"
          d="M18 48 H30 V25 H56 V48 H78"
        />
        <path
          className="landing-workflow-map-route"
          d="M18 48 H30 V25 H56 V48 H78"
        />
        <MapMarker x={18} y={48} label="1" />
        <MapMarker x={56} y={25} label="2" />
        <MapMarker x={78} y={48} label="3" />
        <circle
          className="landing-workflow-map-muted-dot"
          cx="69"
          cy="17"
          r="2.7"
        />
        <circle
          className="landing-workflow-map-muted-dot"
          cx="21"
          cy="15"
          r="2.7"
        />
      </svg>
    </div>
  );
}

function MapMarker({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="landing-workflow-map-marker">
      <circle cx={x} cy={y} r="3.2" />
      <text dominantBaseline="central" textAnchor="middle" x={x} y={y}>
        {label}
      </text>
    </g>
  );
}

export function LandingWorkflowRouteTimeVisual() {
  return (
    <div className="landing-workflow-product-frame landing-workflow-route-card">
      <LandingItineraryStop
        time="09:30"
        name="Airport"
        note="Arrive and collect bags"
        emoji="✈️"
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
        name="Hotel"
        note="Check in and drop your bags"
        emoji="🏨"
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
