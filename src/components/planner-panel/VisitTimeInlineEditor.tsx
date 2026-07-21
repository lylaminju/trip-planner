"use client";

import {
  useEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import {
  DEFAULT_QUICK_VISIT_TIME,
  normalizeQuickVisitTime,
} from "@/lib/quick-visit-time";
import { HOUR_OPTIONS, MINUTE_OPTIONS, splitVisitTime } from "@/lib/visit-time";

export type VisitTimeSegment = "hour" | "minute";

type Props = {
  placeName: string;
  value: string;
  activeSegment: VisitTimeSegment;
  isSaving: boolean;
  error: string | null;
  onValueChange: (value: string) => void;
  onActiveSegmentChange: (segment: VisitTimeSegment) => void;
  onSave: (value?: string) => void;
  onCancel: () => void;
};

export function VisitTimeInlineEditor(props: Props) {
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const normalizedValue =
    normalizeQuickVisitTime(props.value) ?? DEFAULT_QUICK_VISIT_TIME;
  const [hourValue, minuteValue] = splitVisitTime(normalizedValue);
  const minuteOptions = MINUTE_OPTIONS.includes(
    minuteValue as (typeof MINUTE_OPTIONS)[number],
  )
    ? [...MINUTE_OPTIONS]
    : [minuteValue, ...MINUTE_OPTIONS].sort();
  const menuOptions =
    props.activeSegment === "hour" ? HOUR_OPTIONS : minuteOptions;
  const selectedMenuValue =
    props.activeSegment === "hour" ? hourValue : minuteValue;
  const menuLabel =
    props.activeSegment === "hour"
      ? `Choose hour for ${props.placeName}`
      : `Choose minute for ${props.placeName}`;
  const menuValues: readonly string[] = menuOptions;

  useEffect(() => {
    const menu = menuRef.current;
    const option = activeOptionRef.current;
    if (menu && option) {
      menu.scrollTop =
        option.offsetTop - (menu.clientHeight - option.offsetHeight) / 2;
    }
    option?.focus({ preventScroll: true });

    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [props.activeSegment]);

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    props.onSave();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const selectedIndex = menuValues.indexOf(selectedMenuValue);
      const nextIndex = Math.min(
        menuValues.length - 1,
        Math.max(0, (selectedIndex === -1 ? 0 : selectedIndex) + step),
      );
      const nextValue = menuValues[nextIndex];
      if (nextValue !== selectedMenuValue) {
        applyWheelValue(nextValue);
        scrollValueToCenter(nextValue, "smooth");
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      props.onActiveSegmentChange("hour");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      props.onActiveSegmentChange("minute");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      props.onCancel();
    }
  }

  function setHour(nextHour: string) {
    props.onValueChange(`${nextHour}:${minuteValue || "00"}`);
    props.onActiveSegmentChange("minute");
  }

  function setMinute(nextMinute: string) {
    const nextValue = `${hourValue || "09"}:${nextMinute}`;
    props.onValueChange(nextValue);
    props.onSave(nextValue);
  }

  function chooseOption(value: string) {
    if (props.activeSegment === "hour") {
      setHour(value);
      return;
    }

    setMinute(value);
  }

  // Updates the draft to the value under the wheel's center band without
  // committing: hour changes stay on the hour wheel, minute changes wait for
  // an explicit pick or blur to save.
  function applyWheelValue(value: string) {
    if (props.activeSegment === "hour") {
      props.onValueChange(`${value}:${minuteValue || "00"}`);
      return;
    }

    props.onValueChange(`${hourValue || "09"}:${value}`);
  }

  function scrollValueToCenter(value: string, behavior: ScrollBehavior) {
    const menu = menuRef.current;
    const option = menu?.querySelector<HTMLButtonElement>(
      `[data-option-value="${value}"]`,
    );
    if (!menu || !option) {
      return;
    }

    menu.scrollTo({
      behavior,
      top: option.offsetTop - (menu.clientHeight - option.offsetHeight) / 2,
    });
  }

  function handleMenuScroll() {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      const menuCenter = menu.scrollTop + menu.clientHeight / 2;
      let nearestValue: string | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const option of menu.querySelectorAll<HTMLButtonElement>(
        "[data-option-value]",
      )) {
        const distance = Math.abs(
          option.offsetTop + option.offsetHeight / 2 - menuCenter,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestValue = option.dataset.optionValue ?? null;
        }
      }

      if (nearestValue && nearestValue !== selectedMenuValue) {
        applyWheelValue(nearestValue);
      }
    });
  }

  return (
    <span
      className={`visit-time-inline-editor${props.error ? " has-error" : ""}`}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <span
        className="visit-time-editor-display"
        aria-label={`Visit time for ${props.placeName}`}
      >
        <button
          type="button"
          className={`visit-time-segment${
            props.activeSegment === "hour" ? " active" : ""
          }`}
          data-time-segment="hour"
          disabled={props.isSaving}
          aria-label={`Edit visit hour for ${props.placeName}`}
          onClick={() => props.onActiveSegmentChange("hour")}
        >
          {hourValue}
        </button>
        <span className="visit-time-separator" aria-hidden="true">
          :
        </span>
        <button
          type="button"
          className={`visit-time-segment${
            props.activeSegment === "minute" ? " active" : ""
          }`}
          data-time-segment="minute"
          disabled={props.isSaving}
          aria-label={`Edit visit minute for ${props.placeName}`}
          onClick={() => props.onActiveSegmentChange("minute")}
        >
          {minuteValue}
        </button>
      </span>
      <span
        ref={menuRef}
        className={`visit-time-menu ${props.activeSegment}-menu`}
        role="listbox"
        aria-label={menuLabel}
        onScroll={handleMenuScroll}
      >
        {menuOptions.map((value) => {
          const selected = value === selectedMenuValue;

          return (
            <button
              key={value}
              ref={selected ? activeOptionRef : undefined}
              type="button"
              className={`visit-time-menu-option${
                selected ? " selected" : ""
              }`}
              role="option"
              aria-selected={selected}
              data-option-value={value}
              disabled={props.isSaving}
              onClick={() => chooseOption(value)}
            >
              {value}
            </button>
          );
        })}
      </span>
      {props.error && (
        <span className="visit-time-inline-error">{props.error}</span>
      )}
    </span>
  );
}
