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

import { PlusIcon } from "../Icons";
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
  routeGeometries: Map<number, RouteGeometry>;
  markerLabels: Map<number, string>;
  isExpanded: boolean;
  isOpen: boolean;
  isUnscheduledOpen: boolean;
  showRouteSegments: boolean;
  dropTargetKey: string | null;
  onDropTargetChange: Dispatch<SetStateAction<string | null>>;
  onToggleOpen: () => void;
  onToggleUnscheduledOpen: () => void;
  onToggleRouteSegments: () => void;
  onToggleDatePlacePicker: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
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
    if (!hasScheduleDragData(event)) return;

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
        <button
          type="button"
          className={`route-segment-toggle ${props.showRouteSegments ? "active" : ""}`}
          role="switch"
          aria-checked={props.showRouteSegments}
          title={`${props.showRouteSegments ? "Hide" : "Show"} route segments`}
          onClick={props.onToggleRouteSegments}
        >
          <span>Routes</span>
          <span className="route-segment-switch-track" aria-hidden="true">
            <span className="route-segment-switch-knob" />
          </span>
        </button>
      </div>
      {props.isOpen && (
        <div
          className={`itinerary-board ${props.isExpanded ? "expanded" : ""}`}
        >
          {props.itinerary.days.map((day, dayIndex) => (
            <div
              key={day.date}
              className={`day-block ${props.activeDate === day.date ? "active" : ""}`}
              onDragEnter={(event) => activateDropTarget(event, day.date)}
              onDragOver={(event) => activateDropTarget(event, day.date)}
              onDragLeave={leaveDropTarget}
              onDrop={(event) => {
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
                <button
                  type="button"
                  className="day-heading-button"
                  style={{ borderColor: day.color }}
                  aria-pressed={props.activeDate === day.date}
                  onClick={() => props.onSelectDate(day.date)}
                >
                  <span className="day-heading-prefix">{`Day ${dayIndex + 1}`}</span>
                  <span className="day-heading-text">
                    {formatItineraryDateHeading(day.date)}
                  </span>
                </button>
                <button
                  type="button"
                  className="day-add-place-button"
                  aria-label={`Add place to ${formatItineraryDateHeading(day.date)}`}
                  title={`Add place to ${formatItineraryDateHeading(day.date)}`}
                  onClick={(event) =>
                    props.onToggleDatePlacePicker(event, day.date)
                  }
                >
                  <PlusIcon />
                </button>
              </h3>
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
                    {index > 0 && (
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
                      <div className="itinerary-divider" aria-hidden="true" />
                    )}
                    <ItineraryItemRow
                      item={item}
                      active={props.activePlaceId === item.id}
                      markerLabel={props.markerLabels.get(item.id) ?? null}
                      markerColor={day.color}
                      onDragEnd={() => props.onDropTargetChange(null)}
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
                        onSelect={() =>
                          props.onSelectSegment(segmentView.segment.id)
                        }
                        onModeChange={(mode) =>
                          props.onModeChange(segmentView.segment.id, mode)
                        }
                      />
                    )}
                    {showEndTimedDropZone && (
                      <EndInsertionDropZone
                        active={
                          props.dropTargetKey === endDropTargetKey(day.date)
                        }
                        onDragEnter={(event) =>
                          activateDropTarget(event, endDropTargetKey(day.date))
                        }
                        onDragOver={(event) =>
                          activateDropTarget(event, endDropTargetKey(day.date))
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
      onDragEnter={(event) =>
        props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
      }
      onDragOver={(event) =>
        props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
      }
      onDragLeave={props.leaveDropTarget}
      onDrop={(event) => {
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
