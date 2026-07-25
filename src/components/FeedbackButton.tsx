"use client";

import type { ReactNode } from "react";

import { openFeedbackForm } from "@/lib/tally";

type FeedbackButtonProps = {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  title?: string;
};

export function FeedbackButton({
  className,
  children,
  ariaLabel,
  title,
}: FeedbackButtonProps) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={() => {
        void openFeedbackForm();
      }}
    >
      {children}
    </button>
  );
}
