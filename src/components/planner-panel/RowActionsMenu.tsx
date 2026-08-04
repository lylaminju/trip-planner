"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { EllipsisIcon } from "../Icons";

// Row actions render inline on desktop and collapse behind the kebab toggle on
// mobile, where `.visit-row-actions` becomes a popover.
export function RowActionsMenu(props: {
  menuLabel: string;
  children: (closeMenu: () => void) => ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="visit-row-actions-wrap" ref={actionsRef}>
      <button
        type="button"
        className="icon-button visit-row-menu-toggle"
        aria-label={props.menuLabel}
        title={props.menuLabel}
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <EllipsisIcon />
      </button>
      <span
        className={isMenuOpen ? "visit-row-actions open" : "visit-row-actions"}
      >
        {props.children(() => setIsMenuOpen(false))}
      </span>
    </div>
  );
}
