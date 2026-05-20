"use client";

import { useState, type DragEvent } from "react";

import { formatItineraryDateHeading, formatPlaceRow, formatSchedule } from "@/lib/place-display";
import type { ItineraryView, Place, TravelMode } from "@/lib/types";

import { SegmentRow } from "./SegmentRow";

type Props = {
  itinerary: ItineraryView;
  places: Place[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  error: string | null;
  onAdd: () => void;
  onEdit: (place: Place) => void;
  onDelete: (id: number) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onSchedulePlace: (id: number, visitDate: string | null, visitTime: string | null) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
};

export function LeftPanel(props: Props) {
  const [isItinerariesOpen, setIsItinerariesOpen] = useState(true);
  const [isPlacesOpen, setIsPlacesOpen] = useState(true);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  function activateDropTarget(event: DragEvent<HTMLElement>, key: string) {
    if (!hasPlaceDragData(event)) return;

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
    <section className="panel panel-left">
      <header className="app-header">
        <h1>Trip Planner</h1>
        <button type="button" onClick={props.onAdd}>
          Add Place
        </button>
      </header>

      {props.error && <p className="error-text">{props.error}</p>}

      <section className="section-block">
        <SectionToggle
          title="Itineraries"
          open={isItinerariesOpen}
          onToggle={() => setIsItinerariesOpen((value) => !value)}
        />
        {isItinerariesOpen && (
          <>
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
                  const id = Number(event.dataTransfer.getData("text/place-id"));
                  if (!Number.isInteger(id)) return;

                  const place = props.places.find((row) => row.id === id);
                  props.onSchedulePlace(id, day.date, place?.visit_date ? place.visit_time : null);
                }}
              >
                <h3 style={{ borderColor: day.color }}>{formatItineraryDateHeading(day.date)}</h3>
                {day.places.map((place, index) => {
                  const nextPlace = day.places[index + 1];
                  const segmentView = day.segments.find((segment) => segment.fromPlaceId === place.id);
                  const showUntimedDivider =
                    index > 0 && !hasVisitTime(place) && hasVisitTime(day.places[index - 1]);

                  return (
                    <div key={place.id}>
                      {showUntimedDivider && <div className="itinerary-divider" aria-hidden="true" />}
                      <PlaceRow
                        place={place}
                        context="itinerary"
                        active={props.activePlaceId === place.id}
                        draggable
                        onDragEnd={() => setDropTargetKey(null)}
                        onSelect={() => props.onSelectPlace(props.activePlaceId === place.id ? null : place.id)}
                        onEdit={() => {
                          props.onSelectPlace(null);
                          props.onSelectSegment(null);
                          props.onEdit(place);
                        }}
                        onDelete={() => {
                          props.onSelectPlace(null);
                          props.onSelectSegment(null);
                          props.onDelete(place.id);
                        }}
                      />
                      {segmentView && nextPlace && (
                        <SegmentRow
                          segment={segmentView.segment}
                          from={place}
                          to={nextPlace}
                          active={props.activeSegmentId === segmentView.segment.id}
                          onSelect={() => props.onSelectSegment(segmentView.segment.id)}
                          onModeChange={(mode) => props.onModeChange(segmentView.segment.id, mode)}
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
              onDragEnter={(event) => activateDropTarget(event, UNSCHEDULED_DROP_TARGET)}
              onDragOver={(event) => activateDropTarget(event, UNSCHEDULED_DROP_TARGET)}
              onDragLeave={leaveDropTarget}
              onDrop={(event) => {
                event.preventDefault();
                setDropTargetKey(null);
                const id = Number(event.dataTransfer.getData("text/place-id"));
                if (Number.isInteger(id)) {
                  props.onSchedulePlace(id, null, null);
                }
              }}
            >
              <h3>Unscheduled</h3>
              {props.itinerary.unscheduled.map((place) => (
                <PlaceRow
                  key={place.id}
                  place={place}
                  active={props.activePlaceId === place.id}
                  draggable
                  onDragEnd={() => setDropTargetKey(null)}
                  onSelect={() => props.onSelectPlace(props.activePlaceId === place.id ? null : place.id)}
                  onEdit={() => {
                    props.onSelectPlace(null);
                    props.onSelectSegment(null);
                    props.onEdit(place);
                  }}
                  onDelete={() => {
                    props.onSelectPlace(null);
                    props.onSelectSegment(null);
                    props.onDelete(place.id);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="section-block">
        <SectionToggle
          title={`Places (${props.places.length})`}
          open={isPlacesOpen}
          onToggle={() => setIsPlacesOpen((value) => !value)}
        />
        {isPlacesOpen &&
          props.places.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              active={props.activePlaceId === place.id}
              draggable={false}
              reserveDragHandleSpace={false}
              onSelect={() => props.onSelectPlace(props.activePlaceId === place.id ? null : place.id)}
              onEdit={() => {
                props.onSelectPlace(null);
                props.onSelectSegment(null);
                props.onEdit(place);
              }}
              onDelete={() => {
                props.onSelectPlace(null);
                props.onSelectSegment(null);
                props.onDelete(place.id);
              }}
            />
          ))}
      </section>
    </section>
  );
}

function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="section-toggle"
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <h2>{props.title}</h2>
      <span aria-hidden="true">{props.open ? "v" : ">"}</span>
    </button>
  );
}

function PlaceRow(props: {
  place: Place;
  context?: "default" | "itinerary";
  active: boolean;
  draggable: boolean;
  reserveDragHandleSpace?: boolean;
  onDragEnd?: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const display = formatPlaceRow(props.place, { context: props.context });

  return (
    <div className={`place-row ${props.active ? "active" : ""}`}>
      {props.draggable ? (
        <button
          type="button"
          className="drag-handle"
          draggable
          aria-label={`Drag ${props.place.name} to another date`}
          onClick={(event) => event.preventDefault()}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/place-id", String(props.place.id));
            const dragPreview = createDragPreview(props.place);
            document.body.appendChild(dragPreview);
            event.dataTransfer.setDragImage(dragPreview, 16, 16);
            window.setTimeout(() => dragPreview.remove(), 0);
          }}
          onDragEnd={props.onDragEnd}
        >
          ::
        </button>
      ) : props.reserveDragHandleSpace !== false ? (
        <span className="drag-handle-placeholder" aria-hidden="true" />
      ) : null}
      <button type="button" className="place-main" onClick={props.onSelect}>
        <strong className="place-title">
          {display.timePrefix && <span className="place-time">{display.timePrefix}</span>}
          <span className="place-name">{display.title}</span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {props.place.notes && <span className="place-note">{props.place.notes}</span>}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Edit ${props.place.name}`}
        onClick={props.onEdit}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className="icon-button danger-button"
        aria-label={`Delete ${props.place.name}`}
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

function hasVisitTime(place: Place): place is Place & { visit_time: string } {
  return typeof place.visit_time === "string" && place.visit_time.length > 0;
}

function createDragPreview(place: Place): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "place-drag-preview";

  const name = document.createElement("strong");
  name.textContent = place.name;

  const schedule = document.createElement("span");
  schedule.textContent = formatSchedule(place);

  preview.append(name, schedule);
  return preview;
}

function hasPlaceDragData(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("text/place-id");
}

function isLeavingCurrentTarget(event: DragEvent<HTMLElement>): boolean {
  const nextTarget = event.relatedTarget;

  return !(nextTarget instanceof Node && event.currentTarget.contains(nextTarget));
}

const UNSCHEDULED_DROP_TARGET = "unscheduled";
