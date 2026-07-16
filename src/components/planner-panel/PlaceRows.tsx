"use client";

import { formatPlaceRow, formatSchedule, placeInitial } from "@/lib/place-display";
import type { ItineraryItem, Place } from "@/lib/types";

import { DeleteLoadingSpinner } from "../DeleteLoadingSpinner";
import { CalendarPlusIcon, PencilIcon, TrashIcon } from "../Icons";
import { VisitTimeSlot } from "./VisitTimeSlot";

export function ItineraryItemRow(props: {
  item: ItineraryItem;
  active: boolean;
  markerLabel: string | null;
  markerColor: string;
  canEdit: boolean;
  onDragEnd?: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onTimeChange: (visitTime: string | null) => void | Promise<void>;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const display = formatPlaceRow(props.item, { context: "itinerary" });
  const note = props.item.notes ?? props.item.place.notes;
  const rowClassName = [
    "place-row",
    "visit-row",
    props.active ? "active" : "",
    props.isDeleting ? "visit-row-deleting" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const dragLabel = `Drag ${props.item.place.name} to reorder or move date`;
  const editLabel = `Edit visit to ${props.item.place.name}`;
  const deleteLabel = `Delete visit to ${props.item.place.name}`;
  const deleteButtonLabel = props.isDeleting
    ? `Deleting visit to ${props.item.place.name}`
    : deleteLabel;

  return (
    <div className={rowClassName}>
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
      <VisitTimeSlot
        placeName={props.item.place.name}
        visitTime={props.item.visit_time}
        displayTimePrefix={display.timePrefix ?? null}
        canEdit={props.canEdit}
        onTimeChange={props.onTimeChange}
      />
      <span className="visit-thumb-frame">
        <span className="visit-thumb" aria-hidden="true">
          {props.item.place.image_url ? (
            <img
              className="visit-thumb-image"
              src={props.item.place.image_url}
              alt=""
              title={props.item.place.image_credit ?? undefined}
              loading="lazy"
            />
          ) : (
            placeInitial(props.item.place.name)
          )}
        </span>
        {props.markerLabel && (
          <span
            className="place-marker-label"
            style={{ backgroundColor: props.markerColor }}
            aria-label={`Visit order ${props.markerLabel}`}
          >
            {props.markerLabel}
          </span>
        )}
      </span>
      <span className="visit-row-content">
        <button
          type="button"
          className="place-main visit-place-main"
          data-planner-select
          onClick={props.onSelect}
        >
          <span className="visit-row-title-line">
            {props.markerLabel && (
              <span
                className="place-marker-label"
                style={{ backgroundColor: props.markerColor }}
                aria-label={`Visit order ${props.markerLabel}`}
              >
                {props.markerLabel}
              </span>
            )}
            <strong className="place-title">
              <span className="place-title-text">
                <span className="place-name">{display.title}</span>
              </span>
            </strong>
          </span>
          {note && <span className="place-note">{note}</span>}
        </button>
      </span>
      {props.canEdit && (
        <span className="visit-row-actions">
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
            aria-label={deleteButtonLabel}
            title={deleteButtonLabel}
            disabled={props.isDeleting}
            onClick={props.onDelete}
          >
            {props.isDeleting ? <DeleteLoadingSpinner /> : <TrashIcon />}
          </button>
        </span>
      )}
    </div>
  );
}

export function PlaceListRow(props: {
  place: Place;
  active: boolean;
  canEdit: boolean;
  canAddVisit: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onAddVisit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const display = formatPlaceRow(props.place);
  const addVisitLabel = props.canAddVisit
    ? `Add ${props.place.name} to itinerary`
    : `Set trip dates before adding ${props.place.name} to itinerary`;
  const editLabel = `Edit place ${props.place.name}`;
  const deleteLabel = `Delete place ${props.place.name}`;
  const deleteButtonLabel = props.isDeleting
    ? `Deleting place ${props.place.name}`
    : deleteLabel;

  return (
    <div className={`place-row ${props.active ? "active" : ""}`}>
      <button
        type="button"
        className="place-main"
        data-planner-select
        onClick={props.onSelect}
      >
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
            disabled={!props.canAddVisit}
            onClick={props.onAddVisit}
          >
            <CalendarPlusIcon />
          </button>
          <span className="place-row-actions">
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
              aria-label={deleteButtonLabel}
              title={deleteButtonLabel}
              disabled={props.isDeleting}
              onClick={props.onDelete}
            >
              {props.isDeleting ? <DeleteLoadingSpinner /> : <TrashIcon />}
            </button>
          </span>
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
