"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { errorMessage } from "@/lib/error-message";
import { buildGoogleMapsPlaceIdUrl } from "@/lib/maps-url";
import {
  DestinationSearchUnavailableError,
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  type DestinationSuggestion,
  type PlaceSearchBias,
} from "@/lib/places-api";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;
// Modal-specific copy: the server's budget message points at the curated
// destination list, which does not exist in this flow.
const SEARCH_UNAVAILABLE_MESSAGE =
  "Search is unavailable right now — paste a Google Maps link instead.";

export type PlaceSearchSelection = {
  place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
};

type Props = {
  destinationBias: PlaceSearchBias | null;
  onSelectPlace: (selection: PlaceSearchSelection) => void;
  onResolveUrl: (googleMapsUrl: string) => Promise<void>;
};

export function AddPlaceSearchStep({
  destinationBias,
  onSelectPlace,
  onResolveUrl,
}: Props) {
  const listId = useId();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Covers both the details fetch after picking a suggestion and URL resolution.
  const [isBusy, setIsBusy] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    null,
  );
  const [errorText, setErrorText] = useState<string | null>(null);

  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const requestIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const isPastedUrl = isHttpUrl(trimmedQuery);
  const isSearching =
    !isPastedUrl &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    unavailableMessage === null;
  const showPopover = isOpen && (isPastedUrl || isSearching);
  // Primitive deps: a parent re-render must not reset the debounce timer just
  // because it rebuilt the bias object with the same coordinates.
  const biasLatitude = destinationBias?.latitude ?? null;
  const biasLongitude = destinationBias?.longitude ?? null;

  useEffect(() => {
    if (!isSearching) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = (requestIdRef.current += 1);
    setIsLoading(true);
    setErrorText(null);
    const timer = setTimeout(() => {
      fetchDestinationSuggestions(
        trimmedQuery,
        sessionTokenRef.current,
        biasLatitude !== null && biasLongitude !== null
          ? { latitude: biasLatitude, longitude: biasLongitude }
          : null,
      )
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(results);
        })
        .catch((reason) => {
          if (requestId !== requestIdRef.current) return;
          if (reason instanceof DestinationSearchUnavailableError) {
            setUnavailableMessage(SEARCH_UNAVAILABLE_MESSAGE);
            return;
          }
          setErrorText(errorMessage(reason, "Place search failed."));
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setIsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedQuery, isSearching, biasLatitude, biasLongitude]);

  function resetSession() {
    sessionTokenRef.current = crypto.randomUUID();
    requestIdRef.current += 1;
  }

  function closeOnBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(nextTarget)) {
      setIsOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      setIsOpen(true);
    }
  }

  async function selectSuggestion(suggestion: DestinationSuggestion) {
    if (isBusy) return;
    setIsOpen(false);
    setIsBusy(true);
    setErrorText(null);
    try {
      const details = await fetchDestinationDetails(
        suggestion.place_id,
        sessionTokenRef.current,
      );
      onSelectPlace({
        place_id: details.place_id,
        name: details.name,
        latitude: details.latitude,
        longitude: details.longitude,
        google_maps_url:
          details.google_maps_url ??
          buildGoogleMapsPlaceIdUrl(details.place_id),
      });
    } catch (reason) {
      if (reason instanceof DestinationSearchUnavailableError) {
        setUnavailableMessage(SEARCH_UNAVAILABLE_MESSAGE);
      } else {
        setErrorText(errorMessage(reason, "Could not load that place."));
      }
    } finally {
      // The details call ends the billed autocomplete session either way.
      resetSession();
      setIsBusy(false);
    }
  }

  async function resolvePastedUrl() {
    if (isBusy) return;
    setIsOpen(false);
    setIsBusy(true);
    setErrorText(null);
    try {
      await onResolveUrl(trimmedQuery);
    } catch (reason) {
      setErrorText(errorMessage(reason, "Failed to resolve link."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPastedUrl) {
      await resolvePastedUrl();
    }
  }

  return (
    <form className="place-search" onSubmit={handleSubmit}>
      <div className="place-paste-intro">
        <div className="place-paste-icon" aria-hidden="true">
          🔍
        </div>
        <p className="place-paste-title">Search for a place</p>
        <p className="place-paste-hint">
          You can also paste a Google Maps link.
        </p>
      </div>
      <div className="place-search-combobox" onBlur={closeOnBlur}>
        <input
          className="place-paste-input"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search Google Maps"
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPopover}
          aria-controls={listId}
          aria-label="Search Google Maps"
        />
        <div className="place-search-popover" hidden={!showPopover}>
          <div className="place-search-list" id={listId} role="listbox">
            {isPastedUrl ? (
              <button
                type="button"
                className="place-search-option place-search-link-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={resolvePastedUrl}
                role="option"
                aria-selected="false"
                disabled={isBusy}
              >
                {isBusy && <span className="place-spinner" />}
                Add from Google Maps link
              </button>
            ) : suggestions.length === 0 ? (
              <p className="place-search-empty">
                {isLoading ? "Searching…" : "No matching places."}
              </p>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.place_id}
                  className="place-search-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  role="option"
                  aria-selected="false"
                  disabled={isBusy}
                >
                  <span className="place-search-option-name">
                    {suggestion.primary_text}
                  </span>
                  {suggestion.secondary_text ? (
                    <span className="place-search-option-detail">
                      {suggestion.secondary_text}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      {unavailableMessage && (
        <p className="place-search-note" role="status">
          {unavailableMessage}
        </p>
      )}
      {errorText && <p className="error-text">{errorText}</p>}
    </form>
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
