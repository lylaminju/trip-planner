export type TripDateRangeValue = {
  startDate: string;
  endDate: string;
};

export type TripCalendarDay = {
  isoDate: string;
  day: number;
};

export type TripCalendarMonth = {
  label: string;
  monthKey: string;
  days: Array<TripCalendarDay | null>;
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const DAY_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function selectTripDateRangeDate(
  current: TripDateRangeValue,
  selectedDate: string,
): TripDateRangeValue {
  if (!current.startDate || current.endDate) {
    return {
      startDate: selectedDate,
      endDate: "",
    };
  }

  if (selectedDate < current.startDate) {
    return {
      startDate: selectedDate,
      endDate: current.startDate,
    };
  }

  return {
    startDate: current.startDate,
    endDate: selectedDate,
  };
}

export function visibleTripCalendarMonths(
  anchorDateOrMonthKey = todayIsoDate(),
  count = 2,
): string[] {
  const anchorMonthKey = monthKeyFromDateOrMonth(anchorDateOrMonthKey);
  return Array.from({ length: count }, (_, index) =>
    shiftTripCalendarMonth(anchorMonthKey, index),
  );
}

export function shiftTripCalendarMonth(
  monthKey: string,
  offset: number,
): string {
  const parsed = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + offset, 1));
  return monthKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

export function monthKeyFromYearMonth(year: number, month: number): string {
  return monthKeyFromParts(year, month);
}

export function tripCalendarYearFromMonthKey(monthKey: string): number {
  return parseMonthKey(monthKey).year;
}

export function visibleTripCalendarYears(
  anchorYear: number,
  range = 20,
): number[] {
  const startYear = anchorYear - range;
  return Array.from({ length: range * 2 + 1 }, (_, index) => startYear + index);
}

export function buildTripCalendarMonth(monthKey: string): TripCalendarMonth {
  const parsed = parseMonthKey(monthKey);
  const firstDay = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  const daysInMonth = new Date(
    Date.UTC(parsed.year, parsed.month, 0),
  ).getUTCDate();
  const days: Array<TripCalendarDay | null> = Array.from(
    { length: firstDay.getUTCDay() },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      isoDate: isoDateFromParts(parsed.year, parsed.month, day),
      day,
    });
  }

  while (days.length < 42) {
    days.push(null);
  }

  return {
    label: MONTH_LABEL_FORMATTER.format(firstDay),
    monthKey,
    days,
  };
}

export function formatTripDateRangeSummary(
  startDate: string,
  endDate: string,
): string {
  if (!startDate) {
    return "Add dates";
  }

  if (!endDate) {
    return `${formatDateWithYear(startDate)} - End date`;
  }

  if (startDate === endDate) {
    return formatDateWithYear(startDate);
  }

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (start.year === end.year && start.month === end.month) {
    return `${formatDateWithoutYear(startDate)} - ${end.day}, ${end.year}`;
  }

  if (start.year === end.year) {
    return `${formatDateWithoutYear(startDate)} - ${formatDateWithYear(endDate)}`;
  }

  return `${formatDateWithYear(startDate)} - ${formatDateWithYear(endDate)}`;
}

export function isTripDateInRange(
  isoDate: string,
  startDate: string,
  endDate: string,
): boolean {
  return Boolean(
    startDate && endDate && isoDate > startDate && isoDate < endDate,
  );
}

export function monthKeyFromDateOrMonth(dateOrMonthKey: string): string {
  if (/^\d{4}-\d{2}$/.test(dateOrMonthKey)) {
    return dateOrMonthKey;
  }

  const parsed = parseIsoDate(dateOrMonthKey);
  return monthKeyFromParts(parsed.year, parsed.month);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateWithYear(isoDate: string): string {
  return DAY_WITH_YEAR_FORMATTER.format(dateFromIsoDate(isoDate));
}

function formatDateWithoutYear(isoDate: string): string {
  return DAY_MONTH_FORMATTER.format(dateFromIsoDate(isoDate));
}

function dateFromIsoDate(isoDate: string): Date {
  const parsed = parseIsoDate(isoDate);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function parseIsoDate(isoDate: string): {
  day: number;
  month: number;
  year: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return parseIsoDate(todayIsoDate());
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseMonthKey(monthKey: string): {
  month: number;
  year: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    return parseMonthKey(monthKeyFromDateOrMonth(todayIsoDate()));
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function isoDateFromParts(year: number, month: number, day: number): string {
  return `${year}-${twoDigit(month)}-${twoDigit(day)}`;
}

function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${twoDigit(month)}`;
}

function twoDigit(value: number): string {
  return String(value).padStart(2, "0");
}
