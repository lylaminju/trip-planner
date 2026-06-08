import type { VisitDateOption } from "@/lib/types";

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: VisitDateOption[];
};

export function VisitDateField(props: Props) {
  const defaultValue = props.defaultValue ?? "";

  if (props.options.length === 0) {
    return (
      <label>
        {props.label}
        <select name={props.name} disabled defaultValue="">
          <option value="">Set trip dates first</option>
        </select>
      </label>
    );
  }

  const hasDefaultOption =
    defaultValue.length === 0 ||
    props.options.some((option) => option.value === defaultValue);

  return (
    <label>
      {props.label}
      <select name={props.name} defaultValue={defaultValue}>
        <option value="">Unscheduled</option>
        {!hasDefaultOption && (
          <option value={defaultValue}>{`Current date: ${formatLongDate(defaultValue)}`}</option>
        )}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatLongDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}
