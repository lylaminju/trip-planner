"use client";

import type { ItineraryView, Place } from "@/lib/types";

import { PlaceListRow } from "./PlaceRows";
import { SectionToggle } from "./SectionToggle";
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
  return (
    <section className="section-block">
      <div className="section-heading-row">
        <SectionToggle
          title={`Places (${props.places.length})`}
          open={props.isOpen}
          onToggle={props.onToggleOpen}
          compact
        />
        {props.canEdit && (
          <button
            type="button"
            className="section-primary-action"
            onClick={props.onAddPlace}
          >
            Add Place
          </button>
        )}
      </div>
      {props.isOpen && (
        <div className={`places-board ${props.isExpanded ? "expanded" : ""}`}>
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
            );
          })}
        </div>
      )}
    </section>
  );
}
