"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { formatPlaceRow, placeThumbGlyph } from "@/lib/place-display";
import type { ItineraryItem, Place } from "@/lib/types";

import { DeleteLoadingSpinner } from "../DeleteLoadingSpinner";
import {
  CalendarPlusIcon,
  CopyIcon,
  EllipsisIcon,
  PencilIcon,
  TrashIcon,
} from "../Icons";
import { VisitTimeSlot } from "./VisitTimeSlot";

export function ItineraryItemRow(props: {
  item: ItineraryItem;
  active: boolean;
  markerLabel: string | null;
  markerColor: string;
  canEdit: boolean;
  onHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onDuplicate: () => void;
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
  const duplicateLabel = `Duplicate visit to ${props.item.place.name}`;
  const editLabel = `Edit visit to ${props.item.place.name}`;
  const deleteLabel = `Delete visit to ${props.item.place.name}`;
  const deleteButtonLabel = props.isDeleting
    ? `Deleting visit to ${props.item.place.name}`
    : deleteLabel;
  const menuLabel = `Visit actions for ${props.item.place.name}`;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className={rowClassName}>
      {props.canEdit ? (
        <button
          type="button"
          className="drag-handle"
          aria-label={dragLabel}
          title={dragLabel}
          onClick={(event) => event.preventDefault()}
          onPointerDown={props.onHandlePointerDown}
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
            placeThumbGlyph(props.item.place)
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
        <div className="visit-row-actions-wrap" ref={actionsRef}>
          <button
            type="button"
            className="icon-button visit-row-menu-toggle"
            aria-label={menuLabel}
            title={menuLabel}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <EllipsisIcon />
          </button>
          <span
            className={
              isMenuOpen ? "visit-row-actions open" : "visit-row-actions"
            }
          >
            <button
              type="button"
              className="icon-button"
              aria-label={duplicateLabel}
              title={duplicateLabel}
              onClick={() => {
                setIsMenuOpen(false);
                props.onDuplicate();
              }}
            >
              <CopyIcon />
              <span className="visit-row-action-label">Duplicate</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={editLabel}
              title={editLabel}
              onClick={() => {
                setIsMenuOpen(false);
                props.onEdit();
              }}
            >
              <PencilIcon />
              <span className="visit-row-action-label">Edit</span>
            </button>
            <button
              type="button"
              className="icon-button danger-button"
              aria-label={deleteButtonLabel}
              title={deleteButtonLabel}
              disabled={props.isDeleting}
              onClick={() => {
                setIsMenuOpen(false);
                props.onDelete();
              }}
            >
              {props.isDeleting ? <DeleteLoadingSpinner /> : <TrashIcon />}
              <span className="visit-row-action-label">Delete</span>
            </button>
          </span>
        </div>
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

