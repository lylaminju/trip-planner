"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./Icons";
import {
  buildTripCalendarMonth,
  formatTripDateRangeSummary,
  isTripDateInRange,
  monthKeyFromDateOrMonth,
  monthKeyFromYearMonth,
  selectTripDateRangeDate,
  shiftTripCalendarMonth,
  todayIsoDate,
  tripCalendarYearFromMonthKey,
  visibleTripCalendarYears,
  visibleTripCalendarMonths,
  type TripDateRangeValue,
} from "./trip-date-range";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_OPTIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Props = TripDateRangeValue & {
  onChange: (range: TripDateRangeValue) => void;
};

export function TripDateRangePicker(props: Props) {
  const calendarId = useId();
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const monthJumpRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMonthJumpOpen, setIsMonthJumpOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [anchorMonth, setAnchorMonth] = useState(() =>
    monthKeyFromDateOrMonth(props.startDate || todayIsoDate()),
  );
  const [monthJumpYear, setMonthJumpYear] = useState(() =>
    tripCalendarYearFromMonthKey(
      monthKeyFromDateOrMonth(props.startDate || todayIsoDate()),
    ),
  );
  const currentYear = tripCalendarYearFromMonthKey(
    monthKeyFromDateOrMonth(todayIsoDate()),
  );
  const anchorYear = tripCalendarYearFromMonthKey(anchorMonth);
  const anchorMonthNumber = Number(anchorMonth.slice(5, 7));
  const yearOptions = useMemo(
    () => visibleTripCalendarYears(currentYear),
    [currentYear],
  );
  const minJumpYear = yearOptions[0];
  const maxJumpYear = yearOptions[yearOptions.length - 1];
  const monthKeys = useMemo(
    () => visibleTripCalendarMonths(anchorMonth),
    [anchorMonth],
  );
  const months = useMemo(
    () => monthKeys.map((monthKey) => buildTripCalendarMonth(monthKey)),
    [monthKeys],
  );
  const summary = formatTripDateRangeSummary(props.startDate, props.endDate);
  const previewRange = previewTripDateRange(
    {
      startDate: props.startDate,
      endDate: props.endDate,
    },
    hoverDate,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !pickerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isMonthJumpOpen) {
      return;
    }

    function closeMonthJumpOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !monthJumpRef.current?.contains(event.target)
      ) {
        setIsMonthJumpOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      closeMonthJumpOnOutsidePointerDown,
    );
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeMonthJumpOnOutsidePointerDown,
      );
    };
  }, [isMonthJumpOpen]);

  function toggleOpen() {
    const nextAnchorMonth = monthKeyFromDateOrMonth(
      props.startDate || todayIsoDate(),
    );

    setAnchorMonth(nextAnchorMonth);
    setIsMonthJumpOpen(false);
    setIsOpen((current) => !current);
  }

  function showMonth(monthKey: string) {
    setAnchorMonth(monthKey);
  }

  function openMonthJump() {
    setMonthJumpYear(anchorYear);
    setIsMonthJumpOpen(true);
  }

  function shiftMonthJumpYear(offset: number) {
    setMonthJumpYear((current) =>
      Math.min(Math.max(current + offset, minJumpYear), maxJumpYear),
    );
  }

  function pickMonthJumpMonth(monthNumber: number) {
    showMonth(monthKeyFromYearMonth(monthJumpYear, monthNumber));
    setIsMonthJumpOpen(false);
  }

  function shiftVisibleMonth(offset: number) {
    showMonth(shiftTripCalendarMonth(anchorMonth, offset));
  }

  function selectDate(isoDate: string) {
    const nextRange = selectTripDateRangeDate(
      {
        startDate: props.startDate,
        endDate: props.endDate,
      },
      isoDate,
    );
    props.onChange(nextRange);
    setHoverDate(null);
    showMonth(monthKeyFromDateOrMonth(nextRange.startDate));

    if (nextRange.endDate) {
      setIsOpen(false);
    }
  }

  function clearDates() {
    props.onChange({
      startDate: "",
      endDate: "",
    });
    setHoverDate(null);
    showMonth(monthKeyFromDateOrMonth(todayIsoDate()));
  }

  return (
    <div className="trip-date-range-picker" ref={pickerRef}>
      <span className="trip-date-range-label" id={`${calendarId}-label`}>
        Dates
      </span>
      <button
        type="button"
        className="trip-date-range-trigger"
        aria-controls={calendarId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-labelledby={`${calendarId}-label ${calendarId}-summary`}
        onClick={toggleOpen}
      >
        <span className="trip-date-range-trigger-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <span
          id={`${calendarId}-summary`}
          className={
            props.startDate
              ? "trip-date-range-trigger-value"
              : "trip-date-range-trigger-placeholder"
          }
        >
          {props.startDate ? summary : "Add your dates"}
        </span>
      </button>

      {isOpen && (
        <div
          className="trip-date-calendar"
          id={calendarId}
          role="dialog"
          aria-label="Date range calendar"
        >
          {isMonthJumpOpen ? (
            <div className="trip-date-month-jump" ref={monthJumpRef}>
              <div className="trip-date-calendar-header">
                <button
                  type="button"
                  className="trip-date-nav-button"
                  aria-label="Previous year"
                  disabled={monthJumpYear <= minJumpYear}
                  onClick={() => shiftMonthJumpYear(-1)}
                >
                  <ChevronLeftIcon />
                </button>
                <span className="trip-date-month-jump-year">
                  {monthJumpYear}
                </span>
                <button
                  type="button"
                  className="trip-date-nav-button"
                  aria-label="Next year"
                  disabled={monthJumpYear >= maxJumpYear}
                  onClick={() => shiftMonthJumpYear(1)}
                >
                  <ChevronRightIcon />
                </button>
              </div>
              <div className="trip-date-month-jump-grid">
                {MONTH_OPTIONS.map((monthLabel, index) => {
                  const monthNumber = index + 1;
                  const isSelected =
                    monthJumpYear === anchorYear &&
                    monthNumber === anchorMonthNumber;
                  return (
                    <button
                      type="button"
                      key={monthLabel}
                      className={
                        isSelected
                          ? "trip-date-month-jump-option trip-date-month-jump-option-selected"
                          : "trip-date-month-jump-option"
                      }
                      aria-pressed={isSelected}
                      onClick={() => pickMonthJumpMonth(monthNumber)}
                    >
                      {monthLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="trip-date-calendar-header">
                <button
                  type="button"
                  className="trip-date-nav-button"
                  aria-label="Previous month"
                  onClick={() => shiftVisibleMonth(-1)}
                >
                  <ChevronLeftIcon />
                </button>
                <div className="trip-date-calendar-month-jumps">
                  {months.map((month, index) => (
                    <button
                      type="button"
                      key={month.monthKey}
                      className={
                        index === 0
                          ? "trip-date-month-jump-toggle"
                          : "trip-date-month-jump-toggle trip-date-month-jump-toggle-secondary"
                      }
                      aria-haspopup="true"
                      aria-expanded={isMonthJumpOpen}
                      title="Jump to month"
                      onClick={openMonthJump}
                    >
                      {month.label}
                      <ChevronDownIcon />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="trip-date-nav-button"
                  aria-label="Next month"
                  onClick={() => shiftVisibleMonth(1)}
                >
                  <ChevronRightIcon />
                </button>
              </div>

              <div className="trip-date-calendar-months">
                {months.map((month) => (
                  <section
                    className="trip-date-calendar-month"
                    key={month.monthKey}
                    aria-label={month.label}
                  >
                    <div className="trip-date-calendar-grid">
                      {WEEKDAYS.map((weekday) => (
                        <span
                          className="trip-date-calendar-weekday"
                          key={weekday}
                        >
                          {weekday}
                        </span>
                      ))}
                      {month.days.map((day, index) =>
                        day ? (
                          <button
                            type="button"
                            key={day.isoDate}
                            className={dayClassName(
                              day.isoDate,
                              {
                                startDate: props.startDate,
                                endDate: props.endDate,
                              },
                              previewRange,
                            )}
                            aria-pressed={
                              day.isoDate === props.startDate ||
                              day.isoDate === props.endDate
                            }
                            onClick={() => selectDate(day.isoDate)}
                            onFocus={() => setHoverDate(day.isoDate)}
                            onMouseEnter={() => setHoverDate(day.isoDate)}
                          >
                            {day.day}
                          </button>
                        ) : (
                          <span
                            className="trip-date-calendar-empty"
                            key={`${month.monthKey}-blank-${index}`}
                          />
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          <div
            className={
              isMonthJumpOpen
                ? "trip-date-calendar-actions trip-date-calendar-actions-hidden"
                : "trip-date-calendar-actions"
            }
            aria-hidden={isMonthJumpOpen}
          >
            <button
              type="button"
              className="trip-date-clear-button"
              disabled={!props.startDate && !props.endDate}
              onClick={clearDates}
            >
              Clear dates
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function previewTripDateRange(
  current: TripDateRangeValue,
  hoverDate: string | null,
): TripDateRangeValue {
  if (!current.startDate || current.endDate || !hoverDate) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  return hoverDate < current.startDate
    ? {
        startDate: hoverDate,
        endDate: current.startDate,
      }
    : {
        startDate: current.startDate,
        endDate: hoverDate,
      };
}

function dayClassName(
  isoDate: string,
  selectedRange: TripDateRangeValue,
  previewRange: TripDateRangeValue,
): string {
  const classNames = ["trip-date-day"];
  const isStart = isoDate === selectedRange.startDate;
  const isEnd = isoDate === selectedRange.endDate;
  const isSingle =
    isStart &&
    (!selectedRange.endDate ||
      selectedRange.endDate === selectedRange.startDate);

  if (isSingle) {
    classNames.push("trip-date-day-selected-single");
  } else {
    if (isStart) {
      classNames.push("trip-date-day-selected-start");
    }

    if (isEnd) {
      classNames.push("trip-date-day-selected-end");
    }
  }

  if (
    isTripDateInRange(isoDate, selectedRange.startDate, selectedRange.endDate)
  ) {
    classNames.push("trip-date-day-in-range");
  }

  if (
    isTripDateInRange(isoDate, previewRange.startDate, previewRange.endDate)
  ) {
    classNames.push("trip-date-day-preview");
  }

  return classNames.join(" ");
}
