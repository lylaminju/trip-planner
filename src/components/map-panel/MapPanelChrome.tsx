"use client";

import { PlanWithAiButton } from "../PlanWithAiButton";

type Props = {
  hasPlaces: boolean;
  routeGeometryError: string | null;
  currentLocationToast: string | null;
  canShowCurrentLocation: boolean;
  isCurrentLocationActive: boolean;
  canEdit: boolean;
  onToggleCurrentLocation: () => void;
  onAddPlace: () => void;
  onPlanWithAi?: () => void;
  aiPlanMutedHint?: string | null;
};

export function MapPanelChrome(props: Props) {
  return (
    <>
      {!props.hasPlaces && (
        <div className="map-empty-state">
          <p>Add your first place to start building the map.</p>
          {(props.canEdit || props.onPlanWithAi || props.aiPlanMutedHint) && (
            <div className="map-empty-state-actions">
              {props.canEdit && (
                <button
                  type="button"
                  className="map-empty-state-add-button"
                  onClick={props.onAddPlace}
                >
                  Add place
                </button>
              )}
              {/* Same class as the planner header so the two surfaces render
                  one identical control, plus a size variant for the card's
                  roomier type scale. */}
              <PlanWithAiButton
                className="ai-plan-button plan-with-ai-large"
                onPlanWithAi={props.onPlanWithAi}
                mutedHint={props.aiPlanMutedHint}
              />
            </div>
          )}
        </div>
      )}
      {props.routeGeometryError && (
        <div className="map-route-warning">
          <p>{props.routeGeometryError}</p>
        </div>
      )}
      {props.currentLocationToast && props.canShowCurrentLocation && (
        <div className="map-current-location-toast" role="alert">
          {props.currentLocationToast}
        </div>
      )}
      {props.canShowCurrentLocation && (
        <button
          type="button"
          className={`map-current-location-button ${
            props.isCurrentLocationActive ? "active" : ""
          }`}
          aria-label={
            props.isCurrentLocationActive
              ? "Hide my location"
              : "Show my location"
          }
          aria-pressed={props.isCurrentLocationActive}
          title={
            props.isCurrentLocationActive
              ? "Hide my location"
              : "Show my location"
          }
          onClick={props.onToggleCurrentLocation}
        >
          <span className="map-current-location-icon" aria-hidden="true">
            <span />
          </span>
        </button>
      )}
    </>
  );
}
