"use client";

import type { DragEvent } from "react";

import type { ItineraryView, Place } from "@/lib/types";

import { PlaceListRow } from "./PlaceRows";
import { SectionToggle } from "./SectionToggle";
import { UNSCHEDULED_DROP_TARGET, getDraggedItem } from "./drag-schedule";

type Props = {
  itinerary: ItineraryView;
  activeCanonicalPlaceId: number | null;
  dropTargetKey: string | null;
  isOpen: boolean;
  activateDropTarget: (event: DragEvent<HTMLElement>, key: string) => void;
  leaveDropTarget: (event: DragEvent<HTMLElement>) => void;
  onDropTargetChange: (key: string | null) => void;
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
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
};

export function UnscheduledBlock(props: Props) {
  return (
    <div
      className={`unscheduled-block ${
        props.dropTargetKey === UNSCHEDULED_DROP_TARGET ? "drop-target" : ""
      }`}
      onDragEnter={
        props.canEdit
          ? (event) => props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
          : undefined
      }
      onDragOver={
        props.canEdit
          ? (event) => props.activateDropTarget(event, UNSCHEDULED_DROP_TARGET)
          : undefined
      }
      onDragLeave={props.canEdit ? props.leaveDropTarget : undefined}
      onDrop={(event) => {
        if (!props.canEdit) return;
        event.preventDefault();
        props.onDropTargetChange(null);
        const item = getDraggedItem(event, props.itinerary);
        if (item) {
          props.onScheduleItem(item.id, null, null);
        }
      }}
    >
      <SectionToggle
        title="Unscheduled"
        count={props.itinerary.unscheduled.length}
        open={props.isOpen}
        onToggle={props.onToggleOpen}
        headingLevel="h3"
      />
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
