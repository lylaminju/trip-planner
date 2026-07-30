"use client";

import { CollapseToggleButton } from "../CollapseToggleButton";

export function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  count?: number;
  headingLevel?: "h2" | "h3";
}) {
  const HeadingTag = props.headingLevel ?? "h2";

  return (
    <div className="section-toggle">
      <CollapseToggleButton
        className="section-toggle-button"
        iconClassName="section-toggle-icon"
        label={props.title}
        open={props.open}
        onToggle={props.onToggle}
      />
      <HeadingTag>
        {props.title}
        {props.count !== undefined && (
          <span className="section-toggle-count">({props.count})</span>
        )}
      </HeadingTag>
    </div>
  );
}
