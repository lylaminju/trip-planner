"use client";

import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { useMobileSheetDrag } from "@/hooks/useMobileSheetDrag";
import { buildTimedMarkerLabels } from "@/lib/map-marker-labels";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  TravelMode,
} from "@/lib/types";

import { DatePlacePicker } from "./planner-panel/DatePlacePicker";
import { ItinerarySection } from "./planner-panel/ItinerarySection";
import { PlacesSection } from "./planner-panel/PlacesSection";

type Props = {
  title: string;
  itinerary: ItineraryView;
  places: Place[];
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  collapsedDates: ReadonlySet<string>;
  routeGeometries: Map<number, RouteGeometry>;
  error: string | null;
  currentLocationToast: string | null;
  exportFeedback: {
    action: "copy" | "download";
    kind: "error" | "success";
    label: string;
  } | null;
  isExpanded: boolean;
  mobileSheetState: MobileSheetState;
  canEdit: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  deletingItineraryItemIds: ReadonlySet<number>;
  canShowCurrentLocation: boolean;
  isCurrentLocationActive: boolean;
  onToggleExpanded: () => void;
  onMobileSheetStateChange: (state: MobileSheetState) => void;
  onToggleCurrentLocation: () => void;
  onAdd: () => void;
  onCopyExport: () => void;
  onDownloadExport: () => void;
  onLogout: () => void;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDelete: (id: number) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onToggleDateCollapsed: (date: string) => void;
  onSelectDate: (date: string) => void;
  onSchedulePlace: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
  onDeleteItem: (id: number) => void;
};

type PickerState = {
  date: string;
  left: number;
  top: number;
};

export function PlannerPanel(props: Props) {
  const [isItinerariesOpen, setIsItinerariesOpen] = useState(true);
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(false);
  const [isPlacesOpen, setIsPlacesOpen] = useState(true);
  const [showRouteSegments, setShowRouteSegments] = useState(true);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const mobileSheetDrag = useMobileSheetDrag({
    state: props.mobileSheetState,
    onStateChange: props.onMobileSheetStateChange,
  });
  const markerLabels = useMemo(
    () => buildTimedMarkerLabels(props.itinerary),
    [props.itinerary],
  );

  function toggleDatePlacePicker(
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) {
    const bucket = event.currentTarget.closest(".day-block");
    const rect = (bucket ?? event.currentTarget).getBoundingClientRect();
    const width = 320;
    const gap = 10;
    const left = Math.min(rect.right + gap, window.innerWidth - width - 16);
    const maxTop = Math.max(16, window.innerHeight - 380);
    const top = Math.min(Math.max(rect.top + 10, 16), maxTop);

    setPicker((current) => {
      if (current?.date === date) return null;

      return {
        date,
        left: Math.max(16, left),
        top,
      };
    });
  }

  function confirmDeletion(targetLabel: string): boolean {
    return window.confirm(
      `Delete ${targetLabel}?\n\nThis action cannot be restored.`,
    );
  }

  return (
    <section
      className={`panel panel-left mobile-sheet-${props.mobileSheetState} ${
        mobileSheetDrag.dragHeight !== null ? "mobile-sheet-dragging" : ""
      } ${props.isExpanded ? "expanded" : ""}`}
      style={
        mobileSheetDrag.dragHeight === null
          ? undefined
          : ({
              "--mobile-sheet-drag-height": `${mobileSheetDrag.dragHeight}px`,
            } as CSSProperties)
      }
    >
      <button
        type="button"
        className="mobile-sheet-handle"
        aria-label={`Resize itinerary panel, currently ${props.mobileSheetState}`}
        title="Resize itinerary panel"
        onPointerDown={mobileSheetDrag.handlePointerDown}
        onPointerMove={mobileSheetDrag.handlePointerMove}
        onPointerUp={mobileSheetDrag.handlePointerUp}
        onPointerCancel={mobileSheetDrag.handlePointerCancel}
        onClick={mobileSheetDrag.handleClick}
      >
        <span aria-hidden="true" />
      </button>
      <header className="app-header">
        <h1>{props.title}</h1>
        <div className="app-header-actions">
          {props.canEdit && (
            <button type="button" onClick={props.onAdd}>
              Add Place
            </button>
          )}
          {props.canShowCurrentLocation && (
            <button
              type="button"
              className={`current-location-button ${
                props.isCurrentLocationActive ? "active" : ""
              }`}
              aria-pressed={props.isCurrentLocationActive}
              onClick={props.onToggleCurrentLocation}
            >
              {props.isCurrentLocationActive
                ? "Hide my location"
                : "Show my location"}
            </button>
          )}
          <button
            type="button"
            className="desktop-logout-button"
            onClick={props.onLogout}
          >
            Log out
          </button>
          <button
            type="button"
            className="panel-expand-toggle"
            aria-pressed={props.isExpanded}
            title={
              props.isExpanded ? "Restore split view" : "Expand planner panel"
            }
            onClick={props.onToggleExpanded}
          >
            {props.isExpanded ? "<< Collapse" : "Expand >>"}
          </button>
        </div>
      </header>

      {props.currentLocationToast && props.canShowCurrentLocation && (
        <div className="current-location-toast" role="alert">
          {props.currentLocationToast}
        </div>
      )}

      {props.error && <p className="error-text">{props.error}</p>}

      <ItinerarySection
        itinerary={props.itinerary}
        activePlaceId={props.activePlaceId}
        activeCanonicalPlaceId={props.activeCanonicalPlaceId}
        activeSegmentId={props.activeSegmentId}
        activeDate={props.activeDate}
        collapsedDates={props.collapsedDates}
        routeGeometries={props.routeGeometries}
        markerLabels={markerLabels}
        canEdit={props.canEdit}
        canAddVisits={props.canAddVisits}
        deletingPlaceIds={props.deletingPlaceIds}
        deletingItineraryItemIds={props.deletingItineraryItemIds}
        isExpanded={props.isExpanded}
        isOpen={isItinerariesOpen}
        isUnscheduledOpen={isUnscheduledOpen}
        showRouteSegments={showRouteSegments}
        dropTargetKey={dropTargetKey}
        exportFeedback={props.exportFeedback}
        onDropTargetChange={setDropTargetKey}
        onToggleOpen={() => setIsItinerariesOpen((value) => !value)}
        onToggleUnscheduledOpen={() => setIsUnscheduledOpen((value) => !value)}
        onToggleRouteSegments={() => setShowRouteSegments((value) => !value)}
        onCopyExport={props.onCopyExport}
        onDownloadExport={props.onDownloadExport}
        onToggleDatePlacePicker={toggleDatePlacePicker}
        onSelectPlace={props.onSelectPlace}
        onSelectCanonicalPlace={props.onSelectCanonicalPlace}
        onSelectSegment={props.onSelectSegment}
        onToggleDateCollapsed={props.onToggleDateCollapsed}
        onSelectDate={props.onSelectDate}
        onAddVisit={props.onAddVisit}
        onEdit={props.onEdit}
        onEditItem={props.onEditItem}
        onDelete={props.onDelete}
        onDeleteItem={props.onDeleteItem}
        onScheduleItem={props.onScheduleItem}
        onModeChange={props.onModeChange}
        onConfirmDeletion={confirmDeletion}
      />

      <PlacesSection
        places={props.places}
        itinerary={props.itinerary}
        activePlaceId={props.activePlaceId}
        activeCanonicalPlaceId={props.activeCanonicalPlaceId}
        canEdit={props.canEdit}
        canAddVisits={props.canAddVisits}
        deletingPlaceIds={props.deletingPlaceIds}
        isExpanded={props.isExpanded}
        isOpen={isPlacesOpen}
        onToggleOpen={() => setIsPlacesOpen((value) => !value)}
        onSelectPlace={props.onSelectPlace}
        onSelectCanonicalPlace={props.onSelectCanonicalPlace}
        onSelectSegment={props.onSelectSegment}
        onAddVisit={props.onAddVisit}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onConfirmDeletion={confirmDeletion}
      />

      {picker &&
        props.canEdit &&
        typeof document !== "undefined" &&
        createPortal(
          <DatePlacePicker
            date={picker.date}
            places={props.places}
            style={{ left: picker.left, top: picker.top }}
            onClose={() => setPicker(null)}
            onSelect={(place) => {
              props.onSchedulePlace(place.id, picker.date, null);
              setPicker(null);
            }}
          />,
          document.body,
        )}
      <footer className="mobile-logout-footer">
        <button
          type="button"
          className="mobile-logout-button"
          onClick={props.onLogout}
        >
          Log out
        </button>
      </footer>
    </section>
  );
}
