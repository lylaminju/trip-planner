"use client";

export function SectionToggle(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const HeadingTag = props.headingLevel ?? "h2";

  return (
    <button
      type="button"
      className={`section-toggle ${props.compact ? "compact" : ""}`}
      aria-expanded={props.open}
      onClick={props.onToggle}
    >
      <span className="section-toggle-icon" aria-hidden="true">
        {props.open ? "v" : ">"}
      </span>
      <HeadingTag>{props.title}</HeadingTag>
    </button>
  );
}
