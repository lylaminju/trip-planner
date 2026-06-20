"use client";

import type { MouseEvent, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClose: () => void;
};

export function ModalShell({ children, className, onClose }: Props) {
  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.currentTarget === event.target) {
      onClose();
    }
  }

  const classes = ["modal-backdrop", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="presentation" onClick={closeFromBackdrop}>
      {children}
    </div>
  );
}
