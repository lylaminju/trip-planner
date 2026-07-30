"use client";

import { Fragment } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { formatItineraryDateHeading } from "@/lib/place-display";
import type {
  ItineraryDay,
  ItineraryItem,
  RouteGeometry,
  SegmentView,
  TravelMode,
} from "@/lib/types";

import { ChevronRightIcon, PlusIcon } from "../Icons";
import { InsertionPlaceholder } from "./InsertionPlaceholder";
import { ItineraryItemStack } from "./ItineraryItemStack";
import { RouteLegPlaceholder } from "./RouteLegPlaceholder";
import { type DragPreview, hasVisitTime } from "./drag-schedule";

type Props = {
  day: ItineraryDay;
  dayIndex: number;
  collapsed: boolean;
  activePlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  routeGeometries: Map<number, RouteGeometry>;
  markerLabels: Map<number, string>;
  canEdit: boolean;
  deletingItineraryItemIds: ReadonlySet<number>;
  showRouteSegments: boolean;
  dragPreview: DragPreview | null;
  draggingItem: ItineraryItem | null;
  dragRowHeight: number;
  onStartItemDrag: (
    item: ItineraryItem,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onToggleDatePlacePicker: (
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) => void;
  onSelectPlace: (id: number | null) => void;
  onSelectSegment: (id: number | null) => void;
  onToggleDateCollapsed: (date: string) => void;
  onSelectDate: (date: string) => void;
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

export function ItineraryDayBlock(props: Props) {
  const formattedDayHeading = formatItineraryDateHeading(props.day.date);
  const dayBodyId = `itinerary-day-${props.day.date}-body`;
  const dayPrefix = `Day ${props.dayIndex + 1}`;
  const segmentByFromItemId = segmentViewsByFromItemId(props.day.segments);

  const preview = props.dragPreview;
  const draggingItem = props.draggingItem;
  const ownSlotIndex =
    draggingItem === null
      ? -1
      : props.day.items.findIndex((item) => item.id === draggingItem.id);
  const activeSlotPreview =
    preview !== null &&
    preview.kind === "day-slot" &&
    preview.date === props.day.date &&
    draggingItem !== null
      ? preview
      : null;
  // With no target under the pointer, the gap stays in the row's own slot:
  // releasing outside any target leaves the schedule unchanged.
  const slotPreview =
    activeSlotPreview ??
    (preview === null && draggingItem !== null && ownSlotIndex !== -1
      ? {
          kind: "day-slot" as const,
          date: props.day.date,
          index: ownSlotIndex,
          visitTime: draggingItem.visit_time,
          isOwnSlot: true,
        }
      : null);
  const isDayDropTarget =
    preview !== null &&
    preview.kind === "day" &&
    preview.date === props.day.date;

  // The dragged row is lifted out of the list, so slot indexes address the
  // day's rows without it.
  const remainingItems =
    draggingItem === null
      ? props.day.items
      : props.day.items.filter((item) => item.id !== draggingItem.id);
  const gapBeforeItemId =
    slotPreview === null
      ? null
      : (remainingItems[slotPreview.index]?.id ?? null);
  const showEndGap = slotPreview !== null && gapBeforeItemId === null;
  // Route legs only ever connect consecutive timed visits, so the gap shows
  // stand-in legs exactly where the drop will create real ones.
  const previewLegAbove =
    slotPreview !== null &&
    props.showRouteSegments &&
    slotPreview.visitTime !== null &&
    hasVisitTime(remainingItems[slotPreview.index - 1] ?? null);
  const previewLegBelow =
    slotPreview !== null &&
    props.showRouteSegments &&
    slotPreview.visitTime !== null &&
    hasVisitTime(remainingItems[slotPreview.index] ?? null);

  // Lifting a row out of the middle of a day makes its neighbours adjacent,
  // and the drop connects them with a new leg. Preview that leg in the hole
  // the row left, unless the row is previewing back into that same hole.
  const showHoleClosingLeg =
    props.showRouteSegments &&
    ownSlotIndex !== -1 &&
    (slotPreview === null || !slotPreview.isOwnSlot) &&
    hasVisitTime(props.day.items[ownSlotIndex - 1] ?? null) &&
    hasVisitTime(props.day.items[ownSlotIndex + 1] ?? null);

  // Legs a drop would invalidate: the leg into the lifted row and the leg
  // crossing the previewed gap. The gap renders stand-ins for the legs the
  // drop creates, so these come out of the flow entirely. Safe only because
  // the gap is always taller than the leg it collapses, which keeps rows
  // below it moving down and stops the resolved slot from cycling.
  function isStaleSegment(segmentView: SegmentView | null): boolean {
    if (segmentView === null || draggingItem === null) return false;
    return (
      segmentView.toItemId === draggingItem.id ||
      gapBeforeItemId === segmentView.toItemId
    );
  }

  return (
    <div
      className={`day-block ${props.collapsed ? "collapsed" : ""} ${
        props.activeDate === props.day.date ? "active" : ""
      } ${isDayDropTarget ? "drop-target" : ""}`}
      data-day-date={props.day.date}
      data-day-collapsed={props.collapsed ? "true" : "false"}
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
        {props.day.items.length === 0 && slotPreview === null && (
          <p className="day-empty-text">No visits scheduled.</p>
        )}
        {props.day.items.map((item, index) => (
          <Fragment key={item.id}>
            {slotPreview !== null && gapBeforeItemId === item.id && (
              <InsertionPlaceholder
                height={props.dragRowHeight}
                showLegAbove={previewLegAbove}
                showLegBelow={previewLegBelow}
              />
            )}
            {showHoleClosingLeg && draggingItem?.id === item.id && (
              <RouteLegPlaceholder />
            )}
            <ItineraryItemStack
              item={item}
              previousItem={props.day.items[index - 1] ?? null}
              nextItem={props.day.items[index + 1] ?? null}
              segmentView={segmentByFromItemId.get(item.id) ?? null}
              date={props.day.date}
              dayColor={props.day.color}
              activePlaceId={props.activePlaceId}
              activeSegmentId={props.activeSegmentId}
              routeGeometries={props.routeGeometries}
              markerLabel={props.markerLabels.get(item.id) ?? null}
              canEdit={props.canEdit}
              isDeleting={props.deletingItineraryItemIds.has(item.id)}
              isDragSource={draggingItem?.id === item.id}
              isSegmentStale={isStaleSegment(
                segmentByFromItemId.get(item.id) ?? null,
              )}
              showRouteSegments={props.showRouteSegments}
              onStartDrag={(event) => props.onStartItemDrag(item, event)}
              onSelectPlace={props.onSelectPlace}
              onSelectSegment={props.onSelectSegment}
              onDuplicateItem={props.onDuplicateItem}
              onEditItem={props.onEditItem}
              onDeleteItem={props.onDeleteItem}
              onScheduleItem={props.onScheduleItem}
              onModeChange={props.onModeChange}
              onConfirmDeletion={props.onConfirmDeletion}
            />
          </Fragment>
        ))}
        {showEndGap && (
          <InsertionPlaceholder
            height={props.dragRowHeight}
            showLegAbove={previewLegAbove}
            showLegBelow={previewLegBelow}
          />
        )}
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
