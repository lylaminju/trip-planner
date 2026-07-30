"use client";

import type { VisitDateOption } from "@/lib/types";

const TIME_PRESETS = [
  { label: "9 AM", value: "09:00" },
  { label: "2 PM", value: "14:00" },
  { label: "7 PM", value: "19:00" },
] as const;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

function weekdayLabel(iso: string): string {
  return WEEKDAY_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

type Props = {
  visitDateOptions: VisitDateOption[];
  visitDate: string | null;
  visitTime: string | null;
  allowUnscheduled?: boolean;
  onVisitDateChange: (value: string | null) => void;
  onVisitTimeChange: (value: string | null) => void;
};

/**
 * Shared "Which day? / Around what time?" scheduling controls used by both the
 * Add Place and Edit Visit modals so the two stay visually identical.
 *
 * Pass `allowUnscheduled={false}` where a dateless visit cannot be stored: an
 * itinerary item only exists while it has a date, so creating one without a
 * date would be a silent no-op.
 */
export function VisitScheduleFields({
  visitDateOptions,
  visitDate,
  visitTime,
  allowUnscheduled = true,
  onVisitDateChange,
  onVisitTimeChange,
}: Props) {
  return (
    <>
      <div className="place-field">
        <span className="place-field-label">Which day?</span>
        <div className="place-day-grid">
          {visitDateOptions.map((option, index) => {
            const active = visitDate === option.value;
            return (
              <button
                type="button"
                key={option.value}
                className={
                  active
                    ? "place-day-tile place-day-tile--active"
                    : "place-day-tile"
                }
                onClick={() => onVisitDateChange(option.value)}
              >
                <span className="place-day-tile-top">
                  {weekdayLabel(option.value)}
                </span>
                <span className="place-day-tile-big">Day {index + 1}</span>
              </button>
            );
          })}
        </div>
        {allowUnscheduled && (
          <button
            type="button"
            className={
              visitDate === null
                ? "place-later-button place-later-button--active"
                : "place-later-button"
            }
            onClick={() => {
              onVisitDateChange(null);
              onVisitTimeChange(null);
            }}
          >
            Decide later — keep it unscheduled
          </button>
        )}
      </div>

      {visitDate !== null && (
        <div className="place-field">
          <span className="place-field-label">
            Around what time? <span className="place-optional">(optional)</span>
          </span>
          <div className="place-time-row">
            {TIME_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.value}
                className={
                  visitTime === preset.value
                    ? "place-time-pill place-time-pill--active"
                    : "place-time-pill"
                }
                onClick={() => onVisitTimeChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
            <span className="place-time-divider" aria-hidden="true" />
            <input
              type="time"
              className="place-time-input"
              value={visitTime ?? ""}
              onChange={(event) =>
                onVisitTimeChange(event.currentTarget.value || null)
              }
              aria-label="Specific time"
            />
          </div>
        </div>
      )}
    </>
  );
}
