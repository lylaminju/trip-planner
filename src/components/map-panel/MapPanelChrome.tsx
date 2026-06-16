"use client";

type Props = {
  hasPlaces: boolean;
  routeGeometryError: string | null;
  currentLocationToast: string | null;
  canShowCurrentLocation: boolean;
  isCurrentLocationActive: boolean;
  canEdit: boolean;
  onToggleCurrentLocation: () => void;
  onAddPlace: () => void;
};

export function MapPanelChrome(props: Props) {
  return (
    <>
      {!props.hasPlaces && (
        <div className="map-empty-state">
          <p className="map-empty-state-title">No places yet</p>
          <p>Add your first place to start building the map.</p>
          {props.canEdit && (
            <button type="button" onClick={props.onAddPlace}>
              Add place
            </button>
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
