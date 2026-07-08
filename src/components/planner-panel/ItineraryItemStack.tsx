"use client";

import type { DragEvent } from "react";

import type {
  ItineraryItem,
  ItineraryView,
  RouteGeometry,
  SegmentView,
  TravelMode,
} from "@/lib/types";

import { SegmentRow } from "../SegmentRow";
import { EndInsertionDropZone, InsertionDropZone } from "./DropZones";
import { ItineraryItemRow } from "./PlaceRows";
import {
  endDropTargetKey,
  hasVisitTime,
  inferEndVisitTime,
  inferInsertedVisitTime,
  insertionDropTargetKey,
  scheduleDraggedSource,
} from "./drag-schedule";

type Props = {
  item: ItineraryItem;
  itemIndex: number;
  previousItem: ItineraryItem | null;
  nextItem: ItineraryItem | null;
  dayItems: ItineraryItem[];
  segmentView: SegmentView | null;
  date: string;
  dayColor: string;
  itinerary: ItineraryView;
  activePlaceId: number | null;
  activeSegmentId: number | null;
  routeGeometries: Map<number, RouteGeometry>;
  markerLabel: string | null;
  canEdit: boolean;
  isDeleting: boolean;
  showRouteSegments: boolean;
  dropTargetKey: string | null;
  activateDropTarget: (event: DragEvent<HTMLElement>, key: string) => void;
  leaveDropTarget: (event: DragEvent<HTMLElement>) => void;
  onDropTargetChange: (key: string | null) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
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
  const showEndTimedDropZone =
    hasVisitTime(props.item) && !hasVisitTime(props.nextItem);
  const insertionKey =
    previousItem === null
      ? null
      : insertionDropTargetKey(props.date, props.itemIndex);
  const endInsertionKey = endDropTargetKey(props.date);
  const routeSegment = props.segmentView?.segment ?? null;

  return (
    <div className="itinerary-item-stack">
      {props.canEdit && previousItem && insertionKey && (
        <InsertionDropZone
          active={props.dropTargetKey === insertionKey}
          onDragEnter={(event) => props.activateDropTarget(event, insertionKey)}
          onDragOver={(event) => props.activateDropTarget(event, insertionKey)}
          onDragLeave={props.leaveDropTarget}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onDropTargetChange(null);
            scheduleDraggedSource(event, {
              itinerary: props.itinerary,
              date: props.date,
              visitTime: inferInsertedVisitTime(previousItem, props.item),
              onScheduleItem: props.onScheduleItem,
            });
          }}
        />
      )}
      {showUntimedDivider && (
        <div className="itinerary-divider" aria-hidden="true" />
      )}
      <ItineraryItemRow
        item={props.item}
        active={props.activePlaceId === props.item.id}
        markerLabel={props.markerLabel}
        markerColor={props.dayColor}
        onDragEnd={() => props.onDropTargetChange(null)}
        canEdit={props.canEdit}
        isDeleting={props.isDeleting}
        onSelect={() =>
          props.onSelectPlace(
            props.activePlaceId === props.item.id ? null : props.item.id,
          )
        }
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
          onSelect={() => props.onSelectSegment(routeSegment.id)}
          onModeChange={(mode) => props.onModeChange(routeSegment.id, mode)}
        />
      )}
      {props.canEdit && showEndTimedDropZone && (
        <EndInsertionDropZone
          active={props.dropTargetKey === endInsertionKey}
          onDragEnter={(event) =>
            props.activateDropTarget(event, endInsertionKey)
          }
          onDragOver={(event) =>
            props.activateDropTarget(event, endInsertionKey)
          }
          onDragLeave={props.leaveDropTarget}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onDropTargetChange(null);
            scheduleDraggedSource(event, {
              itinerary: props.itinerary,
              date: props.date,
              visitTime: inferEndVisitTime(props.dayItems),
              onScheduleItem: props.onScheduleItem,
            });
          }}
        />
      )}
    </div>
  );
}
