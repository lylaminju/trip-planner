import type { TimeZoneOption } from "@/lib/timezones";

export function TimeZoneSelect(props: {
  value: string;
  options: TimeZoneOption[];
  onChange: (timezone: string) => void;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.currentTarget.value)}
      required
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
