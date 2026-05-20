"use client";

import { useState, type DragEvent } from "react";

import {
  formatItineraryDateHeading,
  formatPlaceRow,
  formatSchedule,
} from "@/lib/place-display";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  TravelMode,
} from "@/lib/types";

import { SegmentRow } from "./SegmentRow";

type Props = {
  itinerary: ItineraryView;
  places: Place[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  error: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onAdd: () => void;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDelete: (id: number) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
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

export function LeftPanel(props: Props) {
  const [isItinerariesOpen, setIsItinerariesOpen] = useState(true);
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(false);
  const [isPlacesOpen, setIsPlacesOpen] = useState(true);
  const [showRouteSegments, setShowRouteSegments] = useState(true);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  function activateDropTarget(event: DragEvent<HTMLElement>, key: string) {
    if (!hasScheduleDragData(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetKey(key);
  }

  function leaveDropTarget(event: DragEvent<HTMLElement>) {
    if (isLeavingCurrentTarget(event)) {
      setDropTargetKey(null);
    }
  }

  return (
    <section className={`panel panel-left ${props.isExpanded ? "expanded" : ""}`}>
      <header className="app-header">
        <h1>Trip Planner</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className="panel-expand-toggle"
            aria-pressed={props.isExpanded}
            title={props.isExpanded ? "Restore split view" : "Expand left panel"}
            onClick={props.onToggleExpanded}
          >
            {props.isExpanded ? "<<" : ">>"}
          </button>
          <button type="button" onClick={props.onAdd}>
            Add Place
          </button>
        </div>
      </header>

      {props.error && <p className="error-text">{props.error}</p>}

      <section className="section-block">
        <div className="section-heading-row">
          <SectionToggle
            title="Itineraries"
            open={isItinerariesOpen}
            onToggle={() => setIsItinerariesOpen((value) => !value)}
            compact
          />
          <button
            type="button"
            className={`route-segment-toggle ${showRouteSegments ? "active" : ""}`}
            role="switch"
            aria-checked={showRouteSegments}
            title={`${showRouteSegments ? "Hide" : "Show"} route segments`}
            onClick={() => setShowRouteSegments((value) => !value)}
          >
            <span>Routes</span>
            <span className="route-segment-switch-track" aria-hidden="true">
              <span className="route-segment-switch-knob" />
            </span>
          </button>
        </div>
        {isItinerariesOpen && (
          <div className={`itinerary-board ${props.isExpanded ? "expanded" : ""}`}>
            {props.itinerary.days.map((day) => (
              <div
                key={day.date}
                className={`day-block ${dropTargetKey === day.date ? "drop-target" : ""}`}
                onDragEnter={(event) => activateDropTarget(event, day.date)}
                onDragOver={(event) => activateDropTarget(event, day.date)}
                onDragLeave={leaveDropTarget}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropTargetKey(null);
                  const item = getDraggedItem(event, props.itinerary);
                  if (item) {
                    props.onScheduleItem(
                      item.id,
                      day.date,
                      item.visit_date ? item.visit_time : null,
                    );
                    return;
                  }

                  const placeId = getDraggedPlaceId(event);
                  if (placeId !== null) {
                    props.onSchedulePlace(placeId, day.date, null);
                  }
                }}
              >
                <h3 style={{ borderColor: day.color }}>
                  {formatItineraryDateHeading(day.date)}
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

                  return (
                    <div key={item.id}>
                      {showUntimedDivider && (
                        <div className="itinerary-divider" aria-hidden="true" />
                      )}
                      <ItineraryItemRow
                        item={item}
                        active={props.activePlaceId === item.id}
                        onDragEnd={() => setDropTargetKey(null)}
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
                          props.onSelectPlace(null);
                          props.onSelectSegment(null);
                          props.onDeleteItem(item.id);
                        }}
                      />
                      {showRouteSegments && segmentView && nextItem && (
                        <SegmentRow
                          segment={segmentView.segment}
                          from={item.place}
                          to={nextItem.place}
                          active={
                            props.activeSegmentId === segmentView.segment.id
                          }
                          onSelect={() =>
                            props.onSelectSegment(segmentView.segment.id)
                          }
                          onModeChange={(mode) =>
                            props.onModeChange(segmentView.segment.id, mode)
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div
              className={`unscheduled-block ${
                dropTargetKey === UNSCHEDULED_DROP_TARGET ? "drop-target" : ""
              }`}
              onDragEnter={(event) =>
                activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
              }
              onDragOver={(event) =>
                activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
              }
              onDragLeave={leaveDropTarget}
              onDrop={(event) => {
                event.preventDefault();
                setDropTargetKey(null);
                const item = getDraggedItem(event, props.itinerary);
                if (item) {
                  props.onScheduleItem(item.id, null, null);
                  return;
                }

                const placeId = getDraggedPlaceId(event);
                if (placeId !== null) {
                  props.onSchedulePlace(placeId, null, null);
                }
              }}
            >
              <SectionToggle
                title="Unscheduled"
                open={isUnscheduledOpen}
                onToggle={() => setIsUnscheduledOpen((value) => !value)}
                headingLevel="h3"
              />
              {isUnscheduledOpen &&
                props.itinerary.unscheduled.map((place) => (
                  <PlaceListRow
                    key={place.id}
                    place={place}
                    active={false}
                    onSelect={() =>
                      props.onSelectPlace(null)
                    }
                    onEdit={() => {
                      props.onSelectPlace(null);
                      props.onSelectSegment(null);
                      props.onEdit(place);
                    }}
                    onAddVisit={() => {
                      props.onSelectPlace(null);
                      props.onSelectSegment(null);
                      props.onAddVisit(place);
                    }}
                    onDelete={() => {
                      props.onSelectPlace(null);
                      props.onSelectSegment(null);
                      props.onDelete(place.id);
                    }}
                  />
                ))}
            </div>
          </div>
        )}
      </section>

      <section className="section-block">
        <SectionToggle
          title={`Places (${props.places.length})`}
          open={isPlacesOpen}
          onToggle={() => setIsPlacesOpen((value) => !value)}
        />
        {isPlacesOpen && (
          <div className={`places-board ${props.isExpanded ? "expanded" : ""}`}>
            {props.places.map((place) => {
              const itemId = getFirstItemIdForPlace(props.itinerary, place.id);

              return (
                <PlaceListRow
                  key={place.id}
                  place={place}
                  active={itemId !== null && props.activePlaceId === itemId}
                  onSelect={() =>
                    props.onSelectPlace(
                      itemId && props.activePlaceId !== itemId ? itemId : null,
                    )
                  }
                  onEdit={() => {
                    props.onSelectPlace(null);
                    props.onSelectSegment(null);
                    props.onEdit(place);
                  }}
                  onAddVisit={() => {
                    props.onSelectPlace(null);
                    props.onSelectSegment(null);
                    props.onAddVisit(place);
                  }}
                  onDelete={() => {
                    props.onSelectPlace(null);
                    props.onSelectSegment(null);
                    props.onDelete(place.id);
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const HeadingTag = props.headingLevel ?? "h2";

  return (
    <button
      type="button"
      className={`section-toggle ${props.compact ? "compact" : ""}`}
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <span className="section-toggle-icon" aria-hidden="true">
        {props.open ? "v" : ">"}
      </span>
      <HeadingTag>{props.title}</HeadingTag>
    </button>
  );
}

function ItineraryItemRow(props: {
  item: ItineraryItem;
  active: boolean;
  onDragEnd?: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const display = formatPlaceRow(props.item, { context: "itinerary" });
  const note = props.item.notes ?? props.item.place.notes;
  const dragLabel = `Drag ${props.item.place.name} to reorder or move date`;
  const editLabel = `Edit visit to ${props.item.place.name}`;
  const deleteLabel = `Delete visit to ${props.item.place.name}`;

  return (
    <div className={`place-row ${props.active ? "active" : ""}`}>
      <button
        type="button"
        className="drag-handle"
        draggable
        aria-label={dragLabel}
        title={dragLabel}
        onClick={(event) => event.preventDefault()}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/itinerary-item-id", String(props.item.id));
          const dragPreview = createDragPreview(props.item);
          document.body.appendChild(dragPreview);
          event.dataTransfer.setDragImage(dragPreview, 16, 16);
          window.setTimeout(() => dragPreview.remove(), 0);
        }}
        onDragEnd={props.onDragEnd}
      >
        ::
      </button>
      <button type="button" className="place-main" onClick={props.onSelect}>
        <strong className="place-title">
          {display.timePrefix && (
            <span className="place-time">{display.timePrefix}</span>
          )}
          <span className="place-name">{display.title}</span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {note && <span className="place-note">{note}</span>}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={editLabel}
        title={editLabel}
        onClick={props.onEdit}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="icon-button danger-button"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={props.onDelete}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PlaceListRow(props: {
  place: Place;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onAddVisit: () => void;
  onDelete: () => void;
}) {
  const display = formatPlaceRow(props.place);
  const dragLabel = `Drag ${props.place.name} to an itinerary date`;
  const addVisitLabel = `Add ${props.place.name} to itinerary`;
  const editLabel = `Edit place ${props.place.name}`;
  const deleteLabel = `Delete place ${props.place.name}`;

  return (
    <div className={`place-row ${props.active ? "active" : ""}`}>
      <button
        type="button"
        className="drag-handle"
        draggable
        aria-label={dragLabel}
        title={dragLabel}
        onClick={(event) => event.preventDefault()}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/place-id", String(props.place.id));
          const dragPreview = createDragPreview(props.place);
          document.body.appendChild(dragPreview);
          event.dataTransfer.setDragImage(dragPreview, 16, 16);
          window.setTimeout(() => dragPreview.remove(), 0);
        }}
      >
        ::
      </button>
      <button type="button" className="place-main" onClick={props.onSelect}>
        <strong className="place-title">
          <span className="place-name">{display.title}</span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {props.place.notes && <span className="place-note">{props.place.notes}</span>}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={addVisitLabel}
        title={addVisitLabel}
        onClick={props.onAddVisit}
      >
        <CalendarPlusIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={editLabel}
        title={editLabel}
        onClick={props.onEdit}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="icon-button danger-button"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={props.onDelete}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4.6L19.7 8.9a2.1 2.1 0 0 0 0-3L18.1 4.3a2.1 2.1 0 0 0-3 0L4 15.4V20Z" />
      <path d="m13.8 5.6 4.6 4.6" />
      <path d="M4 15.4 8.6 20" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function CalendarPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4v3" />
      <path d="M17 4v3" />
      <path d="M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      <path d="M3 11h18" />
      <path d="M12 14v5" />
      <path d="M9.5 16.5h5" />
    </svg>
  );
}

function hasVisitTime(
  item: ItineraryItem,
): item is ItineraryItem & { visit_time: string } {
  return typeof item.visit_time === "string" && item.visit_time.length > 0;
}

function createDragPreview(source: Place | ItineraryItem): HTMLElement {
  const place = "place" in source ? source.place : source;
  const preview = document.createElement("div");
  preview.className = "place-drag-preview";

  const name = document.createElement("strong");
  name.textContent = place.name;

  const schedule = document.createElement("span");
  schedule.textContent =
    "place" in source
      ? formatSchedule(source)
      : (place.address ?? "Unscheduled");

  preview.append(name, schedule);
  return preview;
}

function hasScheduleDragData(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer.types);
  return (
    types.includes("text/place-id") || types.includes("text/itinerary-item-id")
  );
}

function isLeavingCurrentTarget(event: DragEvent<HTMLElement>): boolean {
  const nextTarget = event.relatedTarget;

  return !(
    nextTarget instanceof Node && event.currentTarget.contains(nextTarget)
  );
}

const UNSCHEDULED_DROP_TARGET = "unscheduled";

function getDraggedPlaceId(event: DragEvent<HTMLElement>): number | null {
  const id = Number(event.dataTransfer.getData("text/place-id"));
  return Number.isInteger(id) ? id : null;
}

function getDraggedItem(
  event: DragEvent<HTMLElement>,
  itinerary: ItineraryView,
): ItineraryItem | null {
  const id = Number(event.dataTransfer.getData("text/itinerary-item-id"));
  if (!Number.isInteger(id)) return null;

  return getAllItems(itinerary).find((item) => item.id === id) ?? null;
}

function getFirstItemIdForPlace(
  itinerary: ItineraryView,
  placeId: number,
): number | null {
  return (
    getAllItems(itinerary).find((item) => item.place_id === placeId)?.id ?? null
  );
}

function getAllItems(itinerary: ItineraryView): ItineraryItem[] {
  return [
    ...itinerary.days.flatMap((day) => day.items),
  ];
}
