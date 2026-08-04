"use client";

import type { ItineraryView, Place } from "@/lib/types";

import { PlaceListRow } from "./PlaceRows";
import { SectionToggle } from "./SectionToggle";

type Props = {
  itinerary: ItineraryView;
  activeCanonicalPlaceId: number | null;
  isDropTarget: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectPlace: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  canEdit: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  onAddVisit: (place: Place) => void;
  onEdit: (place: Place) => void;
  onDelete: (id: number) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
};

export function UnscheduledBlock(props: Props) {
  return (
    <div
      className={`unscheduled-block ${props.isDropTarget ? "drop-target" : ""}`}
      data-unscheduled-drop
    >
      <div
        className="unscheduled-heading-row"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) {
            return;
          }
          props.onToggleOpen();
        }}
      >
        <SectionToggle
          title="Unscheduled"
          count={props.itinerary.unscheduled.length}
          open={props.isOpen}
          onToggle={props.onToggleOpen}
          headingLevel="h3"
        />
        {!props.isOpen && props.itinerary.unscheduled.length > 0 && (
          <span className="unscheduled-preview">
            {props.itinerary.unscheduled.map((place) => place.name).join(" · ")}
          </span>
        )}
      </div>
      {props.isOpen &&
        props.itinerary.unscheduled.map((place) => (
          <PlaceListRow
            key={place.id}
            place={place}
            active={props.activeCanonicalPlaceId === place.id}
            canEdit={props.canEdit}
            canAddVisit={props.canAddVisits}
            isDeleting={props.deletingPlaceIds.has(place.id)}
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
        ))}
    </div>
  );
}
