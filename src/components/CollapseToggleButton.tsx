"use client";

import { ChevronRightIcon } from "./Icons";

type Props = {
  className: string;
  label: string;
  open: boolean;
  controlsId?: string;
  iconClassName?: string;
  onToggle: () => void;
};

export function CollapseToggleButton(props: Props) {
  const toggleLabel = `${props.open ? "Collapse" : "Expand"} ${props.label}`;

  return (
    <button
      type="button"
      className={props.className}
      aria-controls={props.controlsId}
      aria-expanded={props.open}
      aria-label={toggleLabel}
      title={toggleLabel}
      onClick={props.onToggle}
    >
      <span className={props.iconClassName} aria-hidden="true">
        <ChevronRightIcon />
      </span>
    </button>
  );
}
