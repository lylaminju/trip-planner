export type TimeZoneOption = {
  value: string;
  label: string;
};

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type TimeZoneOptionsInput = {
  include?: string[];
  now?: Date;
};

export const STABLE_TIMEZONE_REFERENCE_DATE = new Date(
  "2026-01-15T12:00:00.000Z",
);

export function getTimeZoneOptions(
  input: TimeZoneOptionsInput = {},
): TimeZoneOption[] {
  const now = input.now ?? new Date();
  const timeZones = new Set([...supportedTimeZones(), ...FALLBACK_TIMEZONES]);

  return buildTimeZoneOptions(timeZones, input.include, now);
}

export function getStableTimeZoneOptions(
  input: TimeZoneOptionsInput = {},
): TimeZoneOption[] {
  const now = input.now ?? STABLE_TIMEZONE_REFERENCE_DATE;
  return buildTimeZoneOptions(new Set(FALLBACK_TIMEZONES), input.include, now);
}

function buildTimeZoneOptions(
  timeZones: Set<string>,
  include: string[] | undefined,
  now: Date,
): TimeZoneOption[] {
  for (const timeZone of include ?? []) {
    if (timeZone.trim()) {
      timeZones.add(timeZone);
    }
  }

  return [...timeZones]
    .map((timeZone) => ({
      ...formatTimeZoneOption(timeZone, now),
      offsetMinutes: timeZoneOffsetMinutes(timeZone, now),
    }))
    .sort((a, b) => {
      const aOffset = a.offsetMinutes ?? Number.POSITIVE_INFINITY;
      const bOffset = b.offsetMinutes ?? Number.POSITIVE_INFINITY;

      if (aOffset !== bOffset) {
        return aOffset - bOffset;
      }

      return a.value.localeCompare(b.value);
    })
    .map(({ offsetMinutes: _offsetMinutes, ...option }) => option);
}

export function formatTimeZoneOption(
  timeZone: string,
  now = new Date(),
): TimeZoneOption {
  const offset = timeZoneOffsetLabel(timeZone, now);
  if (!offset) {
    return {
      value: timeZone,
      label: timeZone,
    };
  }

  const abbreviation = timeZoneAbbreviation(timeZone, now);
  const prefix =
    abbreviation && abbreviation !== offset
      ? `${offset} ${abbreviation}`
      : offset;

  return {
    value: timeZone,
    label: `${prefix} - ${timeZone}`,
  };
}

export function timeZoneDateFromIsoDate(
  isoDate: string | undefined,
  fallback = new Date(),
): Date {
  if (!isoDate) {
    return fallback;
  }

  const date = new Date(`${isoDate}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (input: "timeZone") => string[];
  };

  try {
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

function timeZoneOffsetLabel(timeZone: string, now: Date): string | null {
  const offset = timeZoneOffsetMinutes(timeZone, now);
  if (offset === null) {
    return null;
  }

  const sign = offset < 0 ? "-" : "+";
  const absoluteOffset = Math.abs(offset);
  const hours = Math.floor(absoluteOffset / 60);
  const minutes = absoluteOffset % 60;

  return `UTC${sign}${padNumber(hours)}:${padNumber(minutes)}`;
}

function timeZoneOffsetMinutes(timeZone: string, now: Date): number | null {
  const offsetName = timeZoneName(timeZone, now, "longOffset");
  if (!offsetName) {
    return null;
  }

  const match = offsetName.match(
    /^GMT(?:(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?)?$/,
  );

  if (!match?.groups?.sign) {
    return 0;
  }

  const hours = Number(match.groups.hours);
  const minutes = Number(match.groups.minutes ?? "0");
  const offset = hours * 60 + minutes;

  return match.groups.sign === "-" ? -offset : offset;
}

function timeZoneAbbreviation(timeZone: string, now: Date): string {
  const abbreviation = timeZoneName(timeZone, now, "short");
  if (!abbreviation) {
    return "";
  }

  if (/^(?:GMT|UTC)[+-]\d{1,2}(?::?\d{2})?$/.test(abbreviation)) {
    return "";
  }

  return abbreviation;
}

function timeZoneName(
  timeZone: string,
  now: Date,
  timeZoneName: "longOffset" | "short",
): string | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName,
    });
    return (
      formatter.formatToParts(now).find((part) => part.type === "timeZoneName")
        ?.value ?? "GMT"
    );
  } catch {
    return null;
  }
}

function padNumber(value: number): string {
  return value.toString().padStart(2, "0");
}
