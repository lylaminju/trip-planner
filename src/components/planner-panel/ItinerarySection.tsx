"use client";

import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from "react";

import { formatItineraryDateHeading } from "@/lib/place-display";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  RouteGeometry,
  TravelMode,
} from "@/lib/types";

import { ChevronRightIcon, PlusIcon } from "../Icons";
import { SegmentRow } from "../SegmentRow";
import { EndInsertionDropZone, InsertionDropZone } from "./DropZones";
import { ItineraryItemRow, PlaceListRow } from "./PlaceRows";
import { SectionToggle } from "./SectionToggle";
import {
  UNSCHEDULED_DROP_TARGET,
  endDropTargetKey,
  getDraggedItem,
  hasScheduleDragData,
  hasVisitTime,
  inferEndVisitTime,
  inferInsertedVisitTime,
  insertionDropTargetKey,
  isLeavingCurrentTarget,
  scheduleDraggedSource,
} from "./drag-schedule";

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
          {props.itinerary.days.map((day, dayIndex) => {
            const collapsed = props.collapsedDates.has(day.date);
            const formattedDayHeading = formatItineraryDateHeading(day.date);
            const dayBodyId = `itinerary-day-${day.date}-body`;
            const dayPrefix = `Day ${dayIndex + 1}`;

            return (
              <div
                key={day.date}
                className={`day-block ${
                  props.activeDate === day.date ? "active" : ""
                }`}
                onDragEnter={
                  props.canEdit
                    ? (event) => activateDropTarget(event, day.date)
                    : undefined
                }
                onDragOver={
                  props.canEdit
                    ? (event) => activateDropTarget(event, day.date)
                    : undefined
                }
                onDragLeave={props.canEdit ? leaveDropTarget : undefined}
                onDrop={(event) => {
                  if (!props.canEdit) return;
                  event.preventDefault();
                  props.onDropTargetChange(null);
                  scheduleDraggedSource(event, {
                    itinerary: props.itinerary,
                    date: day.date,
                    visitTime: null,
                    onScheduleItem: props.onScheduleItem,
                  });
                }}
              >
                <h3 className="day-heading">
                  <span className="day-heading-title-group">
                    <button
                      type="button"
                      className="day-collapse-button"
                      aria-expanded={!collapsed}
                      aria-controls={dayBodyId}
                      aria-label={`${collapsed ? "Expand" : "Collapse"} ${formattedDayHeading} itinerary`}
                      title={`${collapsed ? "Expand" : "Collapse"} ${formattedDayHeading} itinerary`}
                      onClick={() => props.onToggleDateCollapsed(day.date)}
                    >
                      <ChevronRightIcon />
                    </button>
                    <button
                      type="button"
                      className="day-heading-button"
                      aria-pressed={props.activeDate === day.date}
                      onClick={() => props.onSelectDate(day.date)}
                    >
                      <span
                        className="day-heading-prefix"
                        style={{ color: day.color }}
                      >
                        {dayPrefix}
                      </span>
                      <span className="day-heading-text">
                        {formattedDayHeading}
                      </span>
                    </button>
                  </span>
                  {props.canEdit && (
                    <button
                      type="button"
                      className="day-add-place-button"
                      aria-label={`Add place to ${formattedDayHeading}`}
                      title={`Add place to ${formattedDayHeading}`}
                      onClick={(event) =>
                        props.onToggleDatePlacePicker(event, day.date)
                      }
                    >
                      <PlusIcon />
                    </button>
                  )}
                </h3>
                <div id={dayBodyId} hidden={collapsed}>
                  {day.items.length === 0 && (
                    <p className="day-empty-text">No visits scheduled.</p>
                  )}
                  {day.items.map((item, index) => {
                    const nextItem = day.items[index + 1];
                    const segmentView = day.segments.find(
                      (segment) => segment.fromItemId === item.id,
                    );
                    const showUntimedDivider =
                      index > 0 &&
                      !hasVisitTime(item) &&
                      hasVisitTime(day.items[index - 1]);
                    const showEndTimedDropZone =
                      hasVisitTime(item) && !hasVisitTime(nextItem ?? null);

                    return (
                      <div key={item.id} className="itinerary-item-stack">
                        {props.canEdit && index > 0 && (
                          <InsertionDropZone
                            active={
                              props.dropTargetKey ===
                              insertionDropTargetKey(day.date, index)
                            }
                            onDragEnter={(event) =>
                              activateDropTarget(
                                event,
                                insertionDropTargetKey(day.date, index),
                              )
                            }
                            onDragOver={(event) =>
                              activateDropTarget(
                                event,
                                insertionDropTargetKey(day.date, index),
                              )
                            }
                            onDragLeave={leaveDropTarget}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              props.onDropTargetChange(null);
                              scheduleDraggedSource(event, {
                                itinerary: props.itinerary,
                                date: day.date,
                                visitTime: inferInsertedVisitTime(
                                  day.items[index - 1],
                                  item,
                                ),
                                onScheduleItem: props.onScheduleItem,
                              });
                            }}
                          />
                        )}
                        {showUntimedDivider && (
                          <div
                            className="itinerary-divider"
                            aria-hidden="true"
                          />
                        )}
                        <ItineraryItemRow
                          item={item}
                          active={props.activePlaceId === item.id}
                          markerLabel={props.markerLabels.get(item.id) ?? null}
                          markerColor={day.color}
                          onDragEnd={() => props.onDropTargetChange(null)}
                          canEdit={props.canEdit}
                          isDeleting={props.deletingItineraryItemIds.has(
                            item.id,
                          )}
                          onSelect={() =>
                            props.onSelectPlace(
                              props.activePlaceId === item.id ? null : item.id,
                            )
                          }
                          onEdit={() => {
                            props.onSelectPlace(null);
                            props.onSelectSegment(null);
                            props.onEditItem(item);
                          }}
                          onDelete={() => {
                            if (
                              !props.onConfirmDeletion(
                                `this visit to ${item.place.name}`,
                              )
                            ) {
                              return;
                            }
                            props.onSelectPlace(null);
                            props.onSelectSegment(null);
                            props.onDeleteItem(item.id);
                          }}
                        />
                        {props.showRouteSegments && segmentView && nextItem && (
                          <SegmentRow
                            segment={segmentView.segment}
                            from={item.place}
                            to={nextItem.place}
                            active={
                              props.activeSegmentId === segmentView.segment.id
                            }
                            durationSeconds={
                              props.routeGeometries.get(segmentView.segment.id)
                                ?.duration_seconds
                            }
                            canEdit={props.canEdit}
                            onSelect={() =>
                              props.onSelectSegment(segmentView.segment.id)
                            }
                            onModeChange={(mode) =>
                              props.onModeChange(segmentView.segment.id, mode)
                            }
                          />
                        )}
                        {props.canEdit && showEndTimedDropZone && (
                          <EndInsertionDropZone
                            active={
                              props.dropTargetKey === endDropTargetKey(day.date)
                            }
                            onDragEnter={(event) =>
                              activateDropTarget(
                                event,
                                endDropTargetKey(day.date),
                              )
                            }
                            onDragOver={(event) =>
                              activateDropTarget(
                                event,
                                endDropTargetKey(day.date),
                              )
                            }
                            onDragLeave={leaveDropTarget}
                            onDrop={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              props.onDropTargetChange(null);
                              scheduleDraggedSource(event, {
                                itinerary: props.itinerary,
                                date: day.date,
                                visitTime: inferEndVisitTime(day.items),
                                onScheduleItem: props.onScheduleItem,
                              });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

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

function UnscheduledBlock(props: {
  itinerary: ItineraryView;
  activeCanonicalPlaceId: number | null;
  dropTargetKey: string | null;
  isOpen: boolean;
  activateDropTarget: (event: DragEvent<HTMLElement>, key: string) => void;
  leaveDropTarget: (event: DragEvent<HTMLElement>) => void;
  onDropTargetChange: Dispatch<SetStateAction<string | null>>;
  onToggleOpen: () => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  canEdit: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onDelete: (id: number) => void;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
}) {
  return (
    <div
      className={`unscheduled-block ${
        props.dropTargetKey === UNSCHEDULED_DROP_TARGET ? "drop-target" : ""
      }`}
      onDragEnter={
        props.canEdit
          ? (event) => props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
          : undefined
      }
      onDragOver={
        props.canEdit
          ? (event) => props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
          : undefined
      }
      onDragLeave={props.canEdit ? props.leaveDropTarget : undefined}
      onDrop={(event) => {
        if (!props.canEdit) return;
        event.preventDefault();
        props.onDropTargetChange(null);
        const item = getDraggedItem(event, props.itinerary);
        if (item) {
          props.onScheduleItem(item.id, null, null);
        }
      }}
    >
      <SectionToggle
        title="Unscheduled"
        open={props.isOpen}
        onToggle={props.onToggleOpen}
        headingLevel="h3"
      />
      {props.isOpen &&
        props.itinerary.unscheduled.map((place) => (
          <PlaceListRow
            key={place.id}
            place={place}
            active={props.activeCanonicalPlaceId === place.id}
            canEdit={props.canEdit}
            canAddVisit={props.canAddVisits}
            isDeleting={props.deletingPlaceIds.has(place.id)}
            onSelect={() =>
              props.onSelectCanonicalPlace(
                props.activeCanonicalPlaceId === place.id ? null : place.id,
              )
            }
            onEdit={() => {
              props.onSelectPlace(null);
              props.onSelectCanonicalPlace(null);
              props.onSelectSegment(null);
              props.onEdit(place);
            }}
            onAddVisit={() => {
              props.onSelectPlace(null);
              props.onSelectCanonicalPlace(null);
              props.onSelectSegment(null);
              props.onAddVisit(place);
            }}
            onDelete={() => {
              if (!props.onConfirmDeletion(`place ${place.name}`)) {
                return;
              }
              props.onSelectPlace(null);
              props.onSelectCanonicalPlace(null);
              props.onSelectSegment(null);
              props.onDelete(place.id);
            }}
          />
        ))}
    </div>
  );
}
