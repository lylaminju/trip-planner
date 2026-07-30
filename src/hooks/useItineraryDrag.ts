"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  type DragPreview,
  dragPreviewsEqual,
  insertionIndexFromPointer,
  resolveDayDropSchedule,
  resolveDaySlotInsertion,
} from "@/components/planner-panel/drag-schedule";
import type { ItineraryItem, ItineraryView } from "@/lib/types";

// Pointer travel before a press becomes a drag, so pressing the handle
// without moving never flashes a preview.
const DRAG_ACTIVATION_DISTANCE_PX = 4;
const DAY_BLOCK_SELECTOR = "[data-day-date]";
const UNSCHEDULED_SELECTOR = "[data-unscheduled-drop]";
const ROW_SELECTOR = ".itinerary-item-stack:not(.drag-source) > .place-row";
const DRAG_ACTIVE_BODY_CLASS = "visit-drag-active";

export type ItineraryDragGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ItineraryDrag = {
  item: ItineraryItem;
  preview: DragPreview | null;
  geometry: ItineraryDragGeometry;
};

type PendingDrag = {
  item: ItineraryItem;
  pointerId: number;
  startX: number;
  startY: number;
  pointerOffsetY: number;
  geometry: ItineraryDragGeometry;
};

type Options = {
  itinerary: ItineraryView;
  canEdit: boolean;
  onScheduleItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
};

// Drives itinerary drag-and-drop from pointer events rather than the native
// HTML5 drag API: the browser owns the cursor and the drag image during a
// native drag, so neither the grabbing cursor nor a row that tracks the
// pointer is reachable there.
export function useItineraryDrag(options: Options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [drag, setDrag] = useState<ItineraryDrag | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const dragRef = useRef<ItineraryDrag | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const floaterRef = useRef<HTMLDivElement | null>(null);

  const startItemDrag = useCallback(
    (item: ItineraryItem, event: ReactPointerEvent<HTMLElement>) => {
      if (!optionsRef.current.canEdit || event.button !== 0) return;

      const row = event.currentTarget.closest(".place-row");
      if (!(row instanceof HTMLElement)) return;

      // Keeps the press from starting a text selection that would fight the
      // drag as the pointer sweeps across rows.
      event.preventDefault();

      const rect = row.getBoundingClientRect();
      pendingRef.current = {
        item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        pointerOffsetY: event.clientY - rect.top,
        geometry: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      };
      setSessionOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (!sessionOpen) return;

    function endSession() {
      pendingRef.current = null;
      dragRef.current = null;
      setDrag(null);
      setSessionOpen(false);
    }

    function handleMove(event: PointerEvent) {
      const pending = pendingRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;

      if (dragRef.current === null) {
        const travelled = Math.hypot(
          event.clientX - pending.startX,
          event.clientY - pending.startY,
        );
        if (travelled < DRAG_ACTIVATION_DISTANCE_PX) return;

        const started: ItineraryDrag = {
          item: pending.item,
          preview: null,
          geometry: {
            ...pending.geometry,
            top: event.clientY - pending.pointerOffsetY,
          },
        };
        dragRef.current = started;
        setDrag(started);
      }

      // Position the floating row directly so tracking the pointer never
      // re-renders the planner; only a slot change updates React state.
      const floater = floaterRef.current;
      if (floater) {
        floater.style.top = `${event.clientY - pending.pointerOffsetY}px`;
      }

      const current = dragRef.current;
      if (current === null) return;

      const preview = resolvePreview(
        event.clientX,
        event.clientY,
        current.item,
        optionsRef.current.itinerary,
      );
      if (!dragPreviewsEqual(current.preview, preview)) {
        const next = { ...current, preview };
        dragRef.current = next;
        setDrag(next);
      }
    }

    function handleUp(event: PointerEvent) {
      const pending = pendingRef.current;
      if (pending && event.pointerId !== pending.pointerId) return;

      const current = dragRef.current;
      endSession();
      if (current) {
        commitDrop(current, optionsRef.current);
      }
    }

    function handleCancel() {
      endSession();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") endSession();
    }

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleCancel);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleCancel);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sessionOpen]);

  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;

    document.body.classList.add(DRAG_ACTIVE_BODY_CLASS);
    return () => {
      document.body.classList.remove(DRAG_ACTIVE_BODY_CLASS);
    };
  }, [isDragging]);

  return { drag, floaterRef, startItemDrag };
}

// Resolve what the pointer is over: a slot inside an expanded day, a
// collapsed day as a whole, or the unscheduled list.
function resolvePreview(
  clientX: number,
  clientY: number,
  item: ItineraryItem,
  itinerary: ItineraryView,
): DragPreview | null {
  const target = document.elementFromPoint(clientX, clientY);
  if (!(target instanceof Element)) return null;

  if (target.closest(UNSCHEDULED_SELECTOR)) {
    return { kind: "unscheduled" };
  }

  const dayBlock = target.closest(DAY_BLOCK_SELECTOR);
  if (!(dayBlock instanceof HTMLElement)) return null;

  const date = dayBlock.dataset.dayDate;
  if (!date) return null;
  if (dayBlock.dataset.dayCollapsed === "true") {
    return { kind: "day", date };
  }

  const day = itinerary.days.find((candidate) => candidate.date === date);
  if (!day) return null;

  const midpoints = Array.from(
    dayBlock.querySelectorAll(ROW_SELECTOR),
    (row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2;
    },
  );
  const slot = resolveDaySlotInsertion(
    day.items,
    item,
    insertionIndexFromPointer(clientY, midpoints),
  );

  return {
    kind: "day-slot",
    date,
    index: slot.index,
    visitTime: slot.visitTime,
    isOwnSlot: slot.isOwnSlot,
  };
}

function commitDrop(drag: ItineraryDrag, options: Options) {
  const preview = drag.preview;
  if (preview === null) return;

  if (preview.kind === "unscheduled") {
    options.onScheduleItem(drag.item.id, null, null);
    return;
  }
  if (preview.kind === "day") {
    const schedule = resolveDayDropSchedule(drag.item, preview.date);
    if (schedule) {
      options.onScheduleItem(
        drag.item.id,
        schedule.visitDate,
        schedule.visitTime,
      );
    }
    return;
  }
  if (preview.isOwnSlot) return;

  options.onScheduleItem(drag.item.id, preview.date, preview.visitTime);
}
