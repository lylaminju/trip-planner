"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  MIN_PLACE_QUERY_LENGTH,
  usePlaceSearch,
} from "@/hooks/usePlaceSearch";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";
import { buildResolvableGoogleMapsPlaceUrl } from "@/lib/maps-url";
import type { PlaceSearchBias } from "@/lib/places-api";

import { UrlPreviewHint } from "./UrlPreviewHint";

const POPOVER_GAP = 6;
const POPOVER_MAX_HEIGHT = 260;
const POPOVER_MIN_HEIGHT = 140;
const POPOVER_VIEWPORT_MARGIN = 8;

// Guests can't run live Google search (the places routes are user-only), so the
// field is paste-only for them and says so up front instead of offering a
// search box that dead-ends on an empty result list.
const GUEST_SEARCH_SIGN_IN_HINT =
  "Google search needs a sign-in — paste a Google Maps link instead.";

// useLayoutEffect on the server logs a warning; the fields render to static
// markup in tests, so fall back to useEffect where there is no window.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type PopoverPosition = {
  style: CSSProperties;
  listMaxHeight: number;
};

// Location-biased place search for the wizard's optional location fields (start
// of day, arrival, departure): type a name (e.g. "hotel") to pick from Google
// Places, or paste a Google Maps link. Both paths commit a Google Maps URL to
// `value`, so the rest of the wizard and the generation request keep their
// existing URL contract. Guests can't reach live search (the places routes are
// user-only), so `isGuest` makes the field paste-only.
export function PlaceSearchField({
  tripId,
  value,
  bias,
  countryCodes,
  ariaLabel,
  idleHint,
  isGuest = false,
  onChange,
}: {
  tripId: number;
  value: string;
  bias: PlaceSearchBias | null;
  countryCodes: string[] | null;
  ariaLabel: string;
  idleHint: string;
  isGuest?: boolean;
  onChange: (googleMapsUrl: string) => void;
}) {
  const listId = useId();
  const comboboxRef = useRef<HTMLDivElement>(null);
  // Stepping away from and back to this step remounts the field while the
  // committed URL persists on the parent, so seed the box from the selected
  // place's name (falling back to the raw link) instead of clearing it.
  const [query, setQuery] = useState(() => initialQueryFromValue(value));
  const [isOpen, setIsOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] =
    useState<PopoverPosition | null>(null);

  const trimmedQuery = query.trim();
  const isUrl = isHttpUrl(trimmedQuery);
  // A link being typed or pasted is never a search query, so it spends no
  // autocomplete budget.
  const looksLikeUrl = isUrl || trimmedQuery.toLowerCase().startsWith("http");
  const isSearchMode = !looksLikeUrl;

  const { suggestions, isLoading, isUnavailable, resolvePlace } = usePlaceSearch(
    {
      query,
      active: isOpen && isSearchMode && !isGuest,
      bias,
      countryCodes,
    },
  );

  const showPopover =
    isOpen &&
    isSearchMode &&
    !isGuest &&
    !isUnavailable &&
    trimmedQuery.length >= MIN_PLACE_QUERY_LENGTH;

  // The wizard modal is a bounded, overflow-clipped box, so the dropdown is
  // portaled to <body> and positioned from the input's viewport rect. It flips
  // above the field and caps its height when there isn't room below, so it is
  // never cropped by the modal or the viewport.
  const updatePopoverPosition = useCallback(() => {
    const element = comboboxRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp =
      spaceBelow < POPOVER_MAX_HEIGHT + POPOVER_GAP && spaceAbove > spaceBelow;
    const available =
      (openUp ? spaceAbove : spaceBelow) - POPOVER_GAP - POPOVER_VIEWPORT_MARGIN;
    setPopoverPosition({
      style: {
        position: "fixed",
        left: rect.left,
        width: rect.width,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + POPOVER_GAP }
          : { top: rect.bottom + POPOVER_GAP }),
      },
      listMaxHeight: Math.max(
        POPOVER_MIN_HEIGHT,
        Math.min(POPOVER_MAX_HEIGHT, available),
      ),
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!showPopover) {
      setPopoverPosition(null);
      return;
    }
    updatePopoverPosition();
    const reposition = () => updatePopoverPosition();
    // Capture so scrolling the modal content (not just the window) repositions.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [showPopover, updatePopoverPosition]);

  function handleChange(next: string) {
    setQuery(next);
    setIsOpen(true);
    setError(null);
    if (isHttpUrl(next.trim())) {
      // A pasted link commits immediately; the hint below resolves it.
      onChange(next.trim());
    } else if (value) {
      // Editing the text abandons a previously selected place so a stale URL is
      // never submitted with a changed query.
      onChange("");
    }
  }

  async function pickSuggestion(placeId: string) {
    if (isResolving) return;
    setIsResolving(true);
    setError(null);
    try {
      const details = await resolvePlace(placeId);
      onChange(
        buildResolvableGoogleMapsPlaceUrl({
          name: details.name,
          latitude: details.latitude,
          longitude: details.longitude,
        }),
      );
      setQuery(details.name);
      setIsOpen(false);
    } catch {
      setError("Couldn't load that place — paste a Google Maps link instead.");
    } finally {
      setIsResolving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && showPopover) {
      // Keep Enter inside the combobox: the wizard form otherwise reads it as
      // "advance to the next step" and closes the popover.
      event.preventDefault();
      event.stopPropagation();
      if (suggestions.length > 0) {
        void pickSuggestion(suggestions[0].place_id);
      }
    }
  }

  function closeOnBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  }

  return (
    <div className="ai-place-search">
      <div
        className="ai-place-search-combobox"
        ref={comboboxRef}
        onBlur={closeOnBlur}
      >
        <input
          type="text"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPopover}
          aria-controls={listId}
          aria-label={ariaLabel}
          autoComplete="off"
          placeholder={
            isGuest
              ? "Paste a Google Maps link"
              : "Search a place or paste a Google Maps link"
          }
          onChange={(event) => handleChange(event.currentTarget.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {showPopover &&
          popoverPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="ai-place-search-popover"
              style={popoverPosition.style}
            >
              <div
                className="ai-place-search-list"
                id={listId}
                role="listbox"
                style={{ maxHeight: popoverPosition.listMaxHeight }}
              >
                {suggestions.length === 0 ? (
                  <p className="ai-place-search-empty">
                    {isLoading ? "Searching…" : "No matching places."}
                  </p>
                ) : (
                  suggestions.map((suggestion) => (
                    <button
                      key={suggestion.place_id}
                      type="button"
                      className="ai-place-search-option"
                      role="option"
                      aria-selected="false"
                      disabled={isResolving}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pickSuggestion(suggestion.place_id)}
                    >
                      <span className="ai-place-search-option-name">
                        {suggestion.primary_text}
                      </span>
                      {suggestion.secondary_text ? (
                        <span className="ai-place-search-option-detail">
                          {suggestion.secondary_text}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {isUnavailable ? (
        <span className="ai-field-hint" role="status">
          Search is unavailable right now — paste a Google Maps link instead.
        </span>
      ) : error ? (
        <span className="ai-field-hint ai-field-hint-danger" role="status">
          {error}
        </span>
      ) : (
        <UrlPreviewHint
          tripId={tripId}
          url={value}
          idleHint={isGuest ? GUEST_SEARCH_SIGN_IN_HINT : idleHint}
        />
      )}
    </div>
  );
}

function initialQueryFromValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return parseGoogleMapsUrl(trimmed).name ?? trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
