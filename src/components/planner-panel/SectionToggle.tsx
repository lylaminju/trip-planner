"use client";

import { ChevronRightIcon } from "../Icons";

export function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const HeadingTag = props.headingLevel ?? "h2";
  const toggleLabel = `${props.open ? "Collapse" : "Expand"} ${props.title}`;

  return (
    <div className={`section-toggle ${props.compact ? "compact" : ""}`}>
      <button
        type="button"
        className="section-toggle-button"
        aria-expanded={props.open}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={props.onToggle}
      >
        <span className="section-toggle-icon" aria-hidden="true">
          <ChevronRightIcon />
        </span>
      </button>
      <HeadingTag>{props.title}</HeadingTag>
    </div>
  );
}
