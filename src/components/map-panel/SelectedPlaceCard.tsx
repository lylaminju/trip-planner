"use client";

import { placeThumbGlyph } from "@/lib/place-display";
import type { ItineraryItem, ItineraryView, Place } from "@/lib/types";

import { CloseIcon, ExternalLinkIcon } from "../Icons";

type SelectedVisit = { kind: "visit"; item: ItineraryItem; dayNumber: number };
type SelectedPlace = { kind: "place"; place: Place };

export type SelectedMapTarget = SelectedVisit | SelectedPlace;

export function findSelectedMapTarget(
  itinerary: ItineraryView,
  activePlaceId: number | null,
  activeCanonicalPlaceId: number | null,
): SelectedMapTarget | null {
  if (activePlaceId !== null) {
    for (let dayIndex = 0; dayIndex < itinerary.days.length; dayIndex += 1) {
      const item = itinerary.days[dayIndex].items.find(
        (dayItem) => dayItem.id === activePlaceId,
      );
      if (item) {
        return { kind: "visit", item, dayNumber: dayIndex + 1 };
      }
    }
  }

  if (activeCanonicalPlaceId !== null) {
    const unscheduledPlace = itinerary.unscheduled.find(
      (place) => place.id === activeCanonicalPlaceId,
    );
    if (unscheduledPlace) {
      return { kind: "place", place: unscheduledPlace };
    }

    for (const day of itinerary.days) {
      const item = day.items.find(
        (dayItem) => dayItem.place.id === activeCanonicalPlaceId,
      );
      if (item) {
        return { kind: "place", place: item.place };
      }
    }
  }

  return null;
}

export function SelectedPlaceCard(props: {
  target: SelectedMapTarget;
  canEdit: boolean;
  onEditVisit: (item: ItineraryItem) => void;
  onEditPlace: (place: Place) => void;
  onClose: () => void;
}) {
  const target = props.target;
  const place = target.kind === "visit" ? target.item.place : target.place;
  const notes =
    target.kind === "visit" ? (target.item.notes ?? place.notes) : place.notes;
  const contextLabel =
    target.kind === "visit"
      ? [`Day ${target.dayNumber}`, target.item.visit_time]
          .filter(Boolean)
          .join(" · ")
      : "Saved place";

  return (
    <div className="map-selected-card" aria-label={`Selected ${place.name}`}>
      <div className="map-selected-card-body">
        <span className="map-selected-card-thumb" aria-hidden="true">
          {place.image_url ? (
            <img
              className="map-selected-card-thumb-image"
              src={place.image_url}
              alt=""
              title={place.image_credit ?? undefined}
              loading="lazy"
            />
          ) : (
            placeThumbGlyph(place)
          )}
        </span>
        <div className="map-selected-card-info">
          <strong className="map-selected-card-name">{place.name}</strong>
          <span className="map-selected-card-context">{contextLabel}</span>
          {notes && <span className="map-selected-card-notes">{notes}</span>}
        </div>
        <button
          type="button"
          className="map-selected-card-close"
          aria-label="Close place details"
          title="Close place details"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="map-selected-card-actions">
        {props.canEdit && target.kind === "visit" && (
          <button
            type="button"
            className="map-selected-card-action"
            onClick={() => props.onEditVisit(target.item)}
          >
            Edit visit
          </button>
        )}
        {props.canEdit && target.kind === "place" && (
          <button
            type="button"
            className="map-selected-card-action"
            onClick={() => props.onEditPlace(target.place)}
          >
            Edit place
          </button>
        )}
        <a
          className="map-selected-card-action map-selected-card-maps-link"
          href={place.google_maps_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Google Maps</span>
          <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}
