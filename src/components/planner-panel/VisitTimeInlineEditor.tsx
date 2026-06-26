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

  useEffect(() => {
    activeOptionRef.current?.focus({ preventScroll: true });
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [props.activeSegment, selectedMenuValue]);

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
        className={`visit-time-menu ${props.activeSegment}-menu`}
        role="listbox"
        aria-label={menuLabel}
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
