"use client";

import {
  type ChangeEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
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
  const [isOpen, setIsOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [anchorMonth, setAnchorMonth] = useState(() =>
    monthKeyFromDateOrMonth(props.startDate || todayIsoDate()),
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

  function toggleOpen() {
    const nextAnchorMonth = monthKeyFromDateOrMonth(
      props.startDate || todayIsoDate(),
    );

    setAnchorMonth(nextAnchorMonth);
    setIsOpen((current) => !current);
  }

  function showMonth(monthKey: string) {
    setAnchorMonth(monthKey);
  }

  function shiftVisibleMonth(offset: number) {
    showMonth(shiftTripCalendarMonth(anchorMonth, offset));
  }

  function changeVisibleMonth(event: ChangeEvent<HTMLSelectElement>) {
    showMonth(monthKeyFromYearMonth(anchorYear, Number(event.target.value)));
  }

  function changeVisibleYear(event: ChangeEvent<HTMLSelectElement>) {
    showMonth(
      monthKeyFromYearMonth(Number(event.target.value), anchorMonthNumber),
    );
  }

  function jumpToThisMonth() {
    showMonth(monthKeyFromDateOrMonth(todayIsoDate()));
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
        <span id={`${calendarId}-summary`}>{summary}</span>
      </button>

      {isOpen && (
        <div
          className="trip-date-calendar"
          id={calendarId}
          role="dialog"
          aria-label="Date range calendar"
        >
          <div className="trip-date-calendar-header">
            <button
              type="button"
              className="trip-date-nav-button"
              aria-label="Previous month"
              onClick={() => shiftVisibleMonth(-1)}
            >
              <ChevronLeftIcon />
            </button>
            <div className="trip-date-calendar-selects">
              <label>
                <span className="sr-only">Visible month</span>
                <select
                  className="trip-date-month-select"
                  aria-label="Visible month"
                  value={anchorMonthNumber}
                  onChange={changeVisibleMonth}
                >
                  {MONTH_OPTIONS.map((monthLabel, index) => (
                    <option key={monthLabel} value={index + 1}>
                      {monthLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Visible year</span>
                <select
                  className="trip-date-year-select"
                  aria-label="Visible year"
                  value={anchorYear}
                  onChange={changeVisibleYear}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
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
                <h3>{month.label}</h3>
                <div className="trip-date-calendar-grid">
                  {WEEKDAYS.map((weekday) => (
                    <span className="trip-date-calendar-weekday" key={weekday}>
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

          <div className="trip-date-calendar-actions">
            <button
              type="button"
              className="trip-date-this-month-button"
              onClick={jumpToThisMonth}
            >
              This month
            </button>
            <button
              type="button"
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
  if (isoDate === selectedRange.startDate) {
    classNames.push("trip-date-day-selected-start");
  }

  if (isoDate === selectedRange.endDate) {
    classNames.push("trip-date-day-selected-end");
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
