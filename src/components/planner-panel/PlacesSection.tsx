"use client";

import { useEffect, useRef, type MouseEvent } from "react";

import { MOBILE_MEDIA_QUERY } from "@/lib/breakpoints";
import type { ItineraryView, Place } from "@/lib/types";

import { ChevronRightIcon } from "../Icons";
import { PlaceListRow } from "./PlaceRows";
import { getFirstItemIdForPlace } from "./drag-schedule";

export function PlacesSection(props: {
  places: Place[];
  itinerary: ItineraryView;
  activePlaceId: number | null;
  activeCanonicalPlaceId: number | null;
  canEdit: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  isExpanded: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onAddPlace: () => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onDelete: (id: number) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
}) {
  const trayId = "places-tray";
  const toggleTitle = `${props.isOpen ? "Hide" : "Show"} places list`;
  const trayRef = useRef<HTMLDivElement>(null);

  // On mobile the list expands inline below the dock, so reveal it when opened.
  useEffect(() => {
    if (!props.isOpen || typeof window === "undefined") return;
    if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) return;

    trayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [props.isOpen]);

  function handleDockClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    props.onToggleOpen();
  }

  return (
    <>
      <section className="places-dock" onClick={handleDockClick}>
        <button
          type="button"
          className="places-dock-toggle"
          aria-expanded={props.isOpen}
          aria-controls={trayId}
          title={toggleTitle}
          onClick={props.onToggleOpen}
        >
          <span className="places-dock-chevron" aria-hidden="true">
            <ChevronRightIcon />
          </span>
          Places
          <span className="section-toggle-count">({props.places.length})</span>
        </button>
        {props.canEdit && (
          <button
            type="button"
            className="section-primary-action"
            onClick={props.onAddPlace}
          >
            Add Place
          </button>
        )}
      </section>
      {props.isOpen && (
        <button
          type="button"
          className="places-tray-backdrop"
          aria-label="Close places list"
          onClick={props.onToggleOpen}
        />
      )}
      {props.isOpen && (
        <div className="places-tray" id={trayId} ref={trayRef}>
          <div className={`places-board ${props.isExpanded ? "expanded" : ""}`}>
            {props.places.length === 0 && (
              <p className="places-tray-empty-text">No places saved yet.</p>
            )}
            {props.places.map((place) => {
              const itemId = getFirstItemIdForPlace(props.itinerary, place.id);

              return (
                <PlaceListRow
                  key={place.id}
                  place={place}
                  canEdit={props.canEdit}
                  canAddVisit={props.canAddVisits}
                  isDeleting={props.deletingPlaceIds.has(place.id)}
                  active={
                    props.activeCanonicalPlaceId === place.id ||
                    (itemId !== null && props.activePlaceId === itemId)
                  }
                  onSelect={() =>
                    props.onSelectCanonicalPlace(
                      props.activeCanonicalPlaceId === place.id
                        ? null
                        : place.id,
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
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
