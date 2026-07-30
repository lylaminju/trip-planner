"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

import type {
  ItineraryItem,
  RouteGeometry,
  SegmentView,
  TravelMode,
} from "@/lib/types";

import { SegmentRow } from "../SegmentRow";
import { ItineraryItemRow } from "./PlaceRows";
import { hasVisitTime } from "./drag-schedule";

type Props = {
  item: ItineraryItem;
  previousItem: ItineraryItem | null;
  nextItem: ItineraryItem | null;
  segmentView: SegmentView | null;
  date: string;
  dayColor: string;
  activePlaceId: number | null;
  activeSegmentId: number | null;
  routeGeometries: Map<number, RouteGeometry>;
  markerLabel: string | null;
  canEdit: boolean;
  isDeleting: boolean;
  isDragSource: boolean;
  isSegmentStale: boolean;
  showRouteSegments: boolean;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onDuplicateItem: (item: ItineraryItem) => void;
  onEditItem: (item: ItineraryItem) => void;
  onDeleteItem: (id: number) => void;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
  onConfirmDeletion: (targetLabel: string) => boolean;
};

export function ItineraryItemStack(props: Props) {
  const previousItem = props.previousItem;
  const showUntimedDivider =
    previousItem !== null &&
    !hasVisitTime(props.item) &&
    hasVisitTime(previousItem);
  const routeSegment = props.segmentView?.segment ?? null;

  return (
    <div
      className={`itinerary-item-stack ${props.isDragSource ? "drag-source" : ""}`}
    >
      {showUntimedDivider && (
        <div className="itinerary-divider" aria-hidden="true" />
      )}
      <ItineraryItemRow
        item={props.item}
        active={props.activePlaceId === props.item.id}
        markerLabel={props.markerLabel}
        markerColor={props.dayColor}
        canEdit={props.canEdit}
        isDeleting={props.isDeleting}
        onHandlePointerDown={props.onStartDrag}
        onSelect={() =>
          props.onSelectPlace(
            props.activePlaceId === props.item.id ? null : props.item.id,
          )
        }
        onDuplicate={() => {
          props.onSelectPlace(null);
          props.onSelectSegment(null);
          props.onDuplicateItem(props.item);
        }}
        onEdit={() => {
          props.onSelectPlace(null);
          props.onSelectSegment(null);
          props.onEditItem(props.item);
        }}
        onTimeChange={(visitTime) => {
          props.onScheduleItem(props.item.id, props.date, visitTime);
        }}
        onDelete={() => {
          if (
            !props.onConfirmDeletion(`this visit to ${props.item.place.name}`)
          ) {
            return;
          }
          props.onSelectPlace(null);
          props.onSelectSegment(null);
          props.onDeleteItem(props.item.id);
        }}
      />
      {props.showRouteSegments && routeSegment && props.nextItem && (
        <SegmentRow
          segment={routeSegment}
          from={props.item.place}
          to={props.nextItem.place}
          active={props.activeSegmentId === routeSegment.id}
          durationSeconds={
            props.routeGeometries.get(routeSegment.id)?.duration_seconds
          }
          canEdit={props.canEdit}
          stale={props.isSegmentStale}
          onSelect={() => props.onSelectSegment(routeSegment.id)}
          onModeChange={(mode) => props.onModeChange(routeSegment.id, mode)}
        />
      )}
    </div>
  );
}
