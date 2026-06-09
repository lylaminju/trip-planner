"use client";

import type { CSSProperties } from "react";

import {
  formatItineraryDateHeading,
  formatPlaceRow,
} from "@/lib/place-display";
import type { Place } from "@/lib/types";

import { CloseIcon, PlusIcon } from "../Icons";

export function DatePlacePicker(props: {
  date: string;
  places: Place[];
  style: CSSProperties;
  onClose: () => void;
  onCreatePlace: () => void;
  onSelect: (place: Place) => void;
}) {
  const dateHeading = formatItineraryDateHeading(props.date);

  return (
    <aside
      className="date-place-picker"
      style={props.style}
      aria-label={`Add place to ${dateHeading}`}
    >
      <div className="date-place-picker-header">
        <strong>{dateHeading}</strong>
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
      <button
        type="button"
        className="date-place-picker-create"
        onClick={props.onCreatePlace}
      >
        <PlusIcon />
        <span>New place</span>
      </button>
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
