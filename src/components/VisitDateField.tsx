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

  return (
    <label>
      {props.label}
      <select name={props.name} defaultValue={defaultValue}>
        <option value="">Unscheduled</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
