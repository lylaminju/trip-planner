"use client";

import { formatPlaceRow, formatSchedule } from "@/lib/place-display";
import type { ItineraryItem, Place } from "@/lib/types";

import { CalendarPlusIcon, PencilIcon, TrashIcon } from "../Icons";

export function ItineraryItemRow(props: {
  item: ItineraryItem;
  active: boolean;
  markerLabel: string | null;
  markerColor: string;
  canEdit: boolean;
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
      {props.canEdit ? (
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
      ) : (
        <span className="drag-handle-placeholder" aria-hidden="true" />
      )}
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
          <span className="place-title-text">
            {display.timePrefix && (
              <span className="place-time">{display.timePrefix}</span>
            )}
            <span className="place-name">{display.title}</span>
          </span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {note && <span className="place-note">{note}</span>}
      </button>
      {props.canEdit && (
        <>
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
        </>
      )}
    </div>
  );
}

export function PlaceListRow(props: {
  place: Place;
  active: boolean;
  canEdit: boolean;
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
          <span className="place-title-text">
            <span className="place-name">{display.title}</span>
          </span>
        </strong>
        {display.detail && <span>{display.detail}</span>}
        {props.place.notes && (
          <span className="place-note">{props.place.notes}</span>
        )}
      </button>
      {props.canEdit && (
        <>
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
        </>
      )}
    </div>
  );
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
