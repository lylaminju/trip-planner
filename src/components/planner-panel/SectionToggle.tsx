"use client";

import { CollapseToggleButton } from "../CollapseToggleButton";

export function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const HeadingTag = props.headingLevel ?? "h2";

  return (
    <div className={`section-toggle ${props.compact ? "compact" : ""}`}>
      <CollapseToggleButton
        className="section-toggle-button"
        iconClassName="section-toggle-icon"
        label={props.title}
        open={props.open}
        onToggle={props.onToggle}
      />
      <HeadingTag>{props.title}</HeadingTag>
    </div>
  );
}
