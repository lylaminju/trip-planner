"use client";

import type { DragEvent, MouseEvent } from "react";

import { formatItineraryDateHeading } from "@/lib/place-display";
import type {
  ItineraryDay,
  ItineraryItem,
  ItineraryView,
  RouteGeometry,
  SegmentView,
  TravelMode,
} from "@/lib/types";

import { ChevronRightIcon, PlusIcon } from "../Icons";
import { ItineraryItemStack } from "./ItineraryItemStack";
import { scheduleDraggedSource } from "./drag-schedule";

type Props = {
  day: ItineraryDay;
  dayIndex: number;
  itinerary: ItineraryView;
  collapsed: boolean;
  activePlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  routeGeometries: Map<number, RouteGeometry>;
  markerLabels: Map<number, string>;
  canEdit: boolean;
  deletingItineraryItemIds: ReadonlySet<number>;
  showRouteSegments: boolean;
  dropTargetKey: string | null;
  activateDropTarget: (event: DragEvent<HTMLElement>, key: string) => void;
  leaveDropTarget: (event: DragEvent<HTMLElement>) => void;
  onDropTargetChange: (key: string | null) => void;
  onToggleDatePlacePicker: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onToggleDateCollapsed: (date: string) => void;
  onSelectDate: (date: string) => void;
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

export function ItineraryDayBlock(props: Props) {
  const formattedDayHeading = formatItineraryDateHeading(props.day.date);
  const dayBodyId = `itinerary-day-${props.day.date}-body`;
  const dayPrefix = `Day ${props.dayIndex + 1}`;
  const segmentByFromItemId = segmentViewsByFromItemId(props.day.segments);

  return (
    <div
      className={`day-block ${props.activeDate === props.day.date ? "active" : ""}`}
      onDragEnter={
        props.canEdit
          ? (event) => props.activateDropTarget(event, props.day.date)
          : undefined
      }
      onDragOver={
        props.canEdit
          ? (event) => props.activateDropTarget(event, props.day.date)
          : undefined
      }
      onDragLeave={props.canEdit ? props.leaveDropTarget : undefined}
      onDrop={(event) => {
        if (!props.canEdit) return;
        event.preventDefault();
        props.onDropTargetChange(null);
        scheduleDraggedSource(event, {
          itinerary: props.itinerary,
          date: props.day.date,
          visitTime: null,
          onScheduleItem: props.onScheduleItem,
        });
      }}
    >
      <h3 className="day-heading">
        <span className="day-heading-title-group">
          <button
            type="button"
            className="day-collapse-button"
            aria-expanded={!props.collapsed}
            aria-controls={dayBodyId}
            aria-label={`${props.collapsed ? "Expand" : "Collapse"} ${formattedDayHeading} itinerary`}
            title={`${props.collapsed ? "Expand" : "Collapse"} ${formattedDayHeading} itinerary`}
            onClick={() => props.onToggleDateCollapsed(props.day.date)}
          >
            <ChevronRightIcon />
          </button>
          <button
            type="button"
            className="day-heading-button"
            data-planner-select
            aria-pressed={props.activeDate === props.day.date}
            onClick={() => props.onSelectDate(props.day.date)}
          >
            <span
              className="day-heading-prefix"
              style={{ color: props.day.color }}
            >
              {dayPrefix}
            </span>
            <span className="day-heading-text">{formattedDayHeading}</span>
          </button>
        </span>
        {props.canEdit && (
          <button
            type="button"
            className="day-add-place-button"
            aria-label={`Add place to ${formattedDayHeading}`}
            title={`Add place to ${formattedDayHeading}`}
            onClick={(event) =>
              props.onToggleDatePlacePicker(event, props.day.date)
            }
          >
            <PlusIcon />
          </button>
        )}
      </h3>
      <div id={dayBodyId} hidden={props.collapsed}>
        {props.day.items.length === 0 && (
          <p className="day-empty-text">No visits scheduled.</p>
        )}
        {props.day.items.map((item, index) => (
          <ItineraryItemStack
            key={item.id}
            item={item}
            itemIndex={index}
            previousItem={props.day.items[index - 1] ?? null}
            nextItem={props.day.items[index + 1] ?? null}
            dayItems={props.day.items}
            segmentView={segmentByFromItemId.get(item.id) ?? null}
            date={props.day.date}
            dayColor={props.day.color}
            itinerary={props.itinerary}
            activePlaceId={props.activePlaceId}
            activeSegmentId={props.activeSegmentId}
            routeGeometries={props.routeGeometries}
            markerLabel={props.markerLabels.get(item.id) ?? null}
            canEdit={props.canEdit}
            isDeleting={props.deletingItineraryItemIds.has(item.id)}
            showRouteSegments={props.showRouteSegments}
            dropTargetKey={props.dropTargetKey}
            activateDropTarget={props.activateDropTarget}
            leaveDropTarget={props.leaveDropTarget}
            onDropTargetChange={props.onDropTargetChange}
            onSelectPlace={props.onSelectPlace}
            onSelectSegment={props.onSelectSegment}
            onEditItem={props.onEditItem}
            onDeleteItem={props.onDeleteItem}
            onScheduleItem={props.onScheduleItem}
            onModeChange={props.onModeChange}
            onConfirmDeletion={props.onConfirmDeletion}
          />
        ))}
      </div>
    </div>
  );
}

function segmentViewsByFromItemId(
  segmentViews: SegmentView[],
): Map<number, SegmentView> {
  return new Map(
    segmentViews.map((segmentView) => [segmentView.fromItemId, segmentView]),
  );
}
