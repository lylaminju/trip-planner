"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from "react";

import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  TravelMode,
} from "@/lib/types";

import { TrashIcon } from "../Icons";
import { ItineraryDayBlock } from "./ItineraryDayBlock";
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
  isUnscheduledOpen: boolean;
  showRouteSegments: boolean;
  dropTargetKey: string | null;
  exportFeedback: {
    action: "copy" | "download";
    kind: "error" | "success";
    label: string;
  } | null;
  onDropTargetChange: Dispatch<SetStateAction<string | null>>;
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
  onDuplicateItem: (item: ItineraryItem) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDelete: (id: number) => void;
  onDeleteItem: (id: number) => void;
  onDeleteAllItems: () => void;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
  onConfirmDeletion: (targetLabel: string, note?: string) => boolean;
};

export function ItinerarySection(props: Props) {
  const exportMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeExportMenuOnOutsidePointerDown(event: PointerEvent) {
      const menu = exportMenuRef.current;
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false;
      }
    }

    document.addEventListener(
      "pointerdown",
      closeExportMenuOnOutsidePointerDown,
    );
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeExportMenuOnOutsidePointerDown,
      );
    };
  }, []);

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

  function deleteAllItems() {
    if (
      !props.onConfirmDeletion(
        "all itinerary items",
        "Your place list stays intact.",
      )
    ) {
      return;
    }
    props.onDeleteAllItems();
  }

  const hasScheduledItems = props.itinerary.days.some(
    (day) => day.items.length > 0,
  );

  return (
    <section className="section-block">
      <div className="section-heading-row">
        <div className="section-toggle compact">
          <h2>Itineraries</h2>
          {props.canEdit && hasScheduledItems && (
            <button
              type="button"
              className="section-clear-button"
              aria-label="Delete all itinerary items"
              title="Delete all itinerary items"
              onClick={deleteAllItems}
            >
              <TrashIcon />
            </button>
          )}
        </div>
        <div className="section-heading-actions">
          <details ref={exportMenuRef} className="export-menu">
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
                {props.exportFeedback?.action === "download" ? (
                  props.exportFeedback.label
                ) : (
                  <>
                    Download <span className="export-ext-tag">.md</span> file
                  </>
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
            <span>Route legs</span>
            <span className="route-segment-switch-track" aria-hidden="true">
              <span className="route-segment-switch-knob" />
            </span>
          </button>
        </div>
      </div>
      <div className={`itinerary-board ${props.isExpanded ? "expanded" : ""}`}>
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
            onDuplicateItem={props.onDuplicateItem}
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
