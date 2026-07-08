"use client";

import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from "react";

import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  TravelMode,
} from "@/lib/types";

import { ItineraryDayBlock } from "./ItineraryDayBlock";
import { SectionToggle } from "./SectionToggle";
import { UnscheduledBlock } from "./UnscheduledBlock";
import { hasScheduleDragData, isLeavingCurrentTarget } from "./drag-schedule";

type Props = {
  itinerary: ItineraryView;
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  collapsedDates: ReadonlySet<string>;
  routeGeometries: Map<number, RouteGeometry>;
  markerLabels: Map<number, string>;
  canEdit: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  deletingItineraryItemIds: ReadonlySet<number>;
  isExpanded: boolean;
  isOpen: boolean;
  isUnscheduledOpen: boolean;
  showRouteSegments: boolean;
  dropTargetKey: string | null;
  exportFeedback: {
    action: "copy" | "download";
    kind: "error" | "success";
    label: string;
  } | null;
  onDropTargetChange: Dispatch<SetStateAction<string | null>>;
  onToggleOpen: () => void;
  onToggleUnscheduledOpen: () => void;
  onToggleRouteSegments: () => void;
  onCopyExport: () => void;
  onDownloadExport: () => void;
  onToggleDatePlacePicker: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onToggleDateCollapsed: (date: string) => void;
  onSelectDate: (date: string) => void;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDelete: (id: number) => void;
  onDeleteItem: (id: number) => void;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
};

export function ItinerarySection(props: Props) {
  function activateDropTarget(event: DragEvent<HTMLElement>, key: string) {
    if (!props.canEdit || !hasScheduleDragData(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    props.onDropTargetChange(key);
  }

  function leaveDropTarget(event: DragEvent<HTMLElement>) {
    if (isLeavingCurrentTarget(event)) {
      props.onDropTargetChange(null);
    }
  }

  return (
    <section className="section-block">
      <div className="section-heading-row">
        <SectionToggle
          title="Itineraries"
          open={props.isOpen}
          onToggle={props.onToggleOpen}
          compact
        />
        <div className="section-heading-actions">
          <details className="export-menu">
            <summary>Export</summary>
            <div className="export-menu-content">
              <button
                type="button"
                className={exportFeedbackClass(props.exportFeedback, "copy")}
                onClick={props.onCopyExport}
              >
                {exportFeedbackLabel(
                  props.exportFeedback,
                  "copy",
                  "Copy Markdown",
                )}
              </button>
              <button
                type="button"
                className={exportFeedbackClass(
                  props.exportFeedback,
                  "download",
                )}
                onClick={props.onDownloadExport}
              >
                {exportFeedbackLabel(
                  props.exportFeedback,
                  "download",
                  "Download .md",
                )}
              </button>
            </div>
          </details>
          <button
            type="button"
            className={`route-segment-toggle ${props.showRouteSegments ? "active" : ""}`}
            role="switch"
            aria-checked={props.showRouteSegments}
            title={`${props.showRouteSegments ? "Hide" : "Show"} route segments`}
            onClick={props.onToggleRouteSegments}
          >
            <span>Route details</span>
            <span className="route-segment-switch-track" aria-hidden="true">
              <span className="route-segment-switch-knob" />
            </span>
          </button>
        </div>
      </div>
      {props.isOpen && (
        <div
          className={`itinerary-board ${props.isExpanded ? "expanded" : ""}`}
        >
          {props.itinerary.days.map((day, dayIndex) => (
            <ItineraryDayBlock
              key={day.date}
              day={day}
              dayIndex={dayIndex}
              itinerary={props.itinerary}
              collapsed={props.collapsedDates.has(day.date)}
              activePlaceId={props.activePlaceId}
              activeSegmentId={props.activeSegmentId}
              activeDate={props.activeDate}
              routeGeometries={props.routeGeometries}
              markerLabels={props.markerLabels}
              canEdit={props.canEdit}
              deletingItineraryItemIds={props.deletingItineraryItemIds}
              showRouteSegments={props.showRouteSegments}
              dropTargetKey={props.dropTargetKey}
              activateDropTarget={activateDropTarget}
              leaveDropTarget={leaveDropTarget}
              onDropTargetChange={props.onDropTargetChange}
              onToggleDatePlacePicker={props.onToggleDatePlacePicker}
              onSelectPlace={props.onSelectPlace}
              onSelectSegment={props.onSelectSegment}
              onToggleDateCollapsed={props.onToggleDateCollapsed}
              onSelectDate={props.onSelectDate}
              onEditItem={props.onEditItem}
              onDeleteItem={props.onDeleteItem}
              onScheduleItem={props.onScheduleItem}
              onModeChange={props.onModeChange}
              onConfirmDeletion={props.onConfirmDeletion}
            />
          ))}

          <UnscheduledBlock
            itinerary={props.itinerary}
            activeCanonicalPlaceId={props.activeCanonicalPlaceId}
            dropTargetKey={props.dropTargetKey}
            isOpen={props.isUnscheduledOpen}
            activateDropTarget={activateDropTarget}
            leaveDropTarget={leaveDropTarget}
            onDropTargetChange={props.onDropTargetChange}
            onToggleOpen={props.onToggleUnscheduledOpen}
            onSelectPlace={props.onSelectPlace}
            onSelectCanonicalPlace={props.onSelectCanonicalPlace}
            onSelectSegment={props.onSelectSegment}
            canEdit={props.canEdit}
            canAddVisits={props.canAddVisits}
            deletingPlaceIds={props.deletingPlaceIds}
            onAddVisit={props.onAddVisit}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
            onScheduleItem={props.onScheduleItem}
            onConfirmDeletion={props.onConfirmDeletion}
          />
        </div>
      )}
    </section>
  );
}

function exportFeedbackLabel(
  feedback: Props["exportFeedback"],
  action: "copy" | "download",
  fallback: string,
): string {
  return feedback?.action === action ? feedback.label : fallback;
}

function exportFeedbackClass(
  feedback: Props["exportFeedback"],
  action: "copy" | "download",
): string | undefined {
  if (feedback?.action !== action) {
    return undefined;
  }

  return feedback.kind === "error"
    ? "export-feedback-error"
    : "export-feedback-success";
}
