"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  formatItineraryDateHeading,
  formatPlaceRow,
  formatSchedule,
} from "@/lib/place-display";
import { buildTimedMarkerLabels } from "@/lib/map-marker-labels";
import type {
  ItineraryItem,
  ItineraryView,
  Place,
  TravelMode,
} from "@/lib/types";

import { SegmentRow } from "./SegmentRow";
import {
  CalendarPlusIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "./Icons";

type Props = {
  itinerary: ItineraryView;
  places: Place[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
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

export function LeftPanel(props: Props) {
  const [isItinerariesOpen, setIsItinerariesOpen] = useState(true);
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(false);
  const [isPlacesOpen, setIsPlacesOpen] = useState(true);
  const [showRouteSegments, setShowRouteSegments] = useState(true);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const markerLabels = useMemo(
    () => buildTimedMarkerLabels(props.itinerary),
    [props.itinerary],
  );

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

  return (
    <section
      className={`panel panel-left ${props.isExpanded ? "expanded" : ""}`}
    >
      <header className="app-header">
        <h1>Trip Planner</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className="panel-expand-toggle"
            aria-pressed={props.isExpanded}
            title={
              props.isExpanded ? "Restore split view" : "Expand left panel"
            }
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
          <div
            className={`itinerary-board ${props.isExpanded ? "expanded" : ""}`}
          >
            {props.itinerary.days.map((day) => (
              <div
                key={day.date}
                className={`day-block ${props.activeDate === day.date ? "active" : ""}`}
                onDragEnter={(event) => activateDropTarget(event, day.date)}
                onDragOver={(event) => activateDropTarget(event, day.date)}
                onDragLeave={leaveDropTarget}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropTargetKey(null);
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
                    {formatItineraryDateHeading(day.date)}
                  </button>
                  <button
                    type="button"
                    className="day-add-place-button"
                    aria-label={`Add place to ${formatItineraryDateHeading(day.date)}`}
                    title={`Add place to ${formatItineraryDateHeading(day.date)}`}
                    onClick={(event) => toggleDatePlacePicker(event, day.date)}
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
                            dropTargetKey ===
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
                            setDropTargetKey(null);
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
                        markerLabel={markerLabels.get(item.id) ?? null}
                        markerColor={day.color}
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
                      {showEndTimedDropZone && (
                        <EndInsertionDropZone
                          active={dropTargetKey === endDropTargetKey(day.date)}
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
                            setDropTargetKey(null);
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
                    onSelect={() => props.onSelectPlace(null)}
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
      {picker &&
        typeof document !== "undefined" &&
        createPortal(
          <DatePlacePicker
            dateHeading={formatItineraryDateHeading(picker.date)}
            places={props.places}
            style={{ left: picker.left, top: picker.top }}
            onClose={() => setPicker(null)}
            onSelect={(place) => {
              props.onSchedulePlace(place.id, picker.date, null);
            }}
          />,
          document.body,
        )}
    </section>
  );
}

function DatePlacePicker(props: {
  dateHeading: string;
  places: Place[];
  style: CSSProperties;
  onClose: () => void;
  onSelect: (place: Place) => void;
}) {
  return (
    <aside
      className="date-place-picker"
      style={props.style}
      aria-label={`Add place to ${props.dateHeading}`}
    >
      <div className="date-place-picker-header">
        <strong>{props.dateHeading}</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Close place picker"
          title="Close place picker"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="date-place-picker-list">
        {props.places.length === 0 ? (
          <p className="date-place-picker-empty">No places yet.</p>
        ) : (
          props.places.map((place) => (
            <DatePlacePickerRow
              key={place.id}
              place={place}
              onSelect={() => props.onSelect(place)}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function DatePlacePickerRow(props: { place: Place; onSelect: () => void }) {
  const display = formatPlaceRow(props.place);

  return (
    <button
      type="button"
      className="date-place-picker-row"
      onClick={props.onSelect}
    >
      <span className="date-place-picker-row-main">
        <strong>{display.title}</strong>
        {display.detail && <span>{display.detail}</span>}
      </span>
    </button>
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
  markerLabel: string | null;
  markerColor: string;
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
          event.dataTransfer.setData(
            "text/itinerary-item-id",
            String(props.item.id),
          );
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
          {props.markerLabel && (
            <span
              className="place-marker-label"
              style={{ backgroundColor: props.markerColor }}
              aria-label={`Visit order ${props.markerLabel}`}
            >
              {props.markerLabel}
            </span>
          )}
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
  const addVisitLabel = `Add ${props.place.name} to itinerary`;
  const editLabel = `Edit place ${props.place.name}`;
  const deleteLabel = `Delete place ${props.place.name}`;

  return (
    <div className={`place-row ${props.active ? "active" : ""}`}>
      <button type="button" className="place-main" onClick={props.onSelect}>
        <strong className="place-title">
          <span className="place-name">{display.title}</span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {props.place.notes && (
          <span className="place-note">{props.place.notes}</span>
        )}
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

function InsertionDropZone(props: {
  active: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`itinerary-insertion-zone ${props.active ? "active" : ""}`}
      aria-hidden="true"
      onDragEnter={(event) => {
        event.stopPropagation();
        props.onDragEnter(event);
      }}
      onDragOver={(event) => {
        event.stopPropagation();
        props.onDragOver(event);
      }}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <span />
    </div>
  );
}

function EndInsertionDropZone(props: {
  active: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`itinerary-end-insertion-zone ${props.active ? "active" : ""}`}
      aria-hidden="true"
      onDragEnter={(event) => {
        event.stopPropagation();
        props.onDragEnter(event);
      }}
      onDragOver={(event) => {
        event.stopPropagation();
        props.onDragOver(event);
      }}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <span />
    </div>
  );
}

function hasVisitTime(
  item: ItineraryItem | null,
): item is ItineraryItem & { visit_time: string } {
  return typeof item?.visit_time === "string" && item.visit_time.length > 0;
}

function createDragPreview(source: ItineraryItem): HTMLElement {
  const place = source.place;
  const preview = document.createElement("div");
  preview.className = "place-drag-preview";

  const name = document.createElement("strong");
  name.textContent = place.name;

  const schedule = document.createElement("span");
  schedule.textContent = formatSchedule(source);

  preview.append(name, schedule);
  return preview;
}

function hasScheduleDragData(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes("text/itinerary-item-id");
}

function isLeavingCurrentTarget(event: DragEvent<HTMLElement>): boolean {
  const nextTarget = event.relatedTarget;

  return !(
    nextTarget instanceof Node && event.currentTarget.contains(nextTarget)
  );
}

const UNSCHEDULED_DROP_TARGET = "unscheduled";

function getDraggedItem(
  event: DragEvent<HTMLElement>,
  itinerary: ItineraryView,
): ItineraryItem | null {
  const id = Number(event.dataTransfer.getData("text/itinerary-item-id"));
  if (!Number.isInteger(id)) return null;

  return getAllItems(itinerary).find((item) => item.id === id) ?? null;
}

function scheduleDraggedSource(
  event: DragEvent<HTMLElement>,
  options: {
    itinerary: ItineraryView;
    date: string;
    visitTime: string | null;
    onScheduleItem: (
      id: number,
      visitDate: string | null,
      visitTime: string | null,
    ) => void;
  },
) {
  const item = getDraggedItem(event, options.itinerary);
  if (item) {
    options.onScheduleItem(item.id, options.date, options.visitTime);
  }
}

function inferInsertedVisitTime(
  previous: ItineraryItem,
  next: ItineraryItem,
): string | null {
  const previousMinutes = parseVisitTime(previous.visit_time);
  const nextMinutes = parseVisitTime(next.visit_time);
  if (
    previousMinutes === null ||
    nextMinutes === null ||
    nextMinutes - previousMinutes <= 1
  ) {
    return null;
  }

  const midpoint = (previousMinutes + nextMinutes) / 2;
  const rounded = Math.round(midpoint / 5) * 5;
  const insertedMinutes =
    rounded > previousMinutes && rounded < nextMinutes
      ? rounded
      : Math.floor(midpoint);

  if (insertedMinutes <= previousMinutes || insertedMinutes >= nextMinutes) {
    return null;
  }

  return formatVisitTime(insertedMinutes);
}

function inferEndVisitTime(items: ItineraryItem[]): string | null {
  const timedMinutes = items
    .map((item) => parseVisitTime(item.visit_time))
    .filter((value): value is number => value !== null);
  const lastMinutes = timedMinutes.at(-1);
  if (lastMinutes === undefined) {
    return null;
  }

  return formatVisitTime(Math.min(lastMinutes + 60, 23 * 60 + 59));
}

function parseVisitTime(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatVisitTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function insertionDropTargetKey(date: string, index: number): string {
  return `${date}:insert:${index}`;
}

function endDropTargetKey(date: string): string {
  return `${date}:end`;
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
  return [...itinerary.days.flatMap((day) => day.items)];
}
