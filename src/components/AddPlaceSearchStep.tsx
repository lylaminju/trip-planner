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

import { useDestinationCandidates } from "@/hooks/useDestinationCandidates";
import { matchDestinationCandidates } from "@/lib/destination-candidates";
import { errorMessage } from "@/lib/error-message";
import {
  buildGoogleMapsPlaceIdUrl,
  buildGoogleMapsPlaceLinkUrl,
} from "@/lib/maps-url";
import {
  DestinationSearchUnavailableError,
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  type DestinationSuggestion,
  type PlaceSearchBias,
} from "@/lib/places-api";
import type { AiDestinationCandidate, Place } from "@/lib/types";

import { MapPinIcon } from "./Icons";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;
// Modal-specific copy: the server's budget message points at the curated
// destination list, which does not exist in this flow.
const SEARCH_UNAVAILABLE_MESSAGE =
  "Search is unavailable right now — paste a Google Maps link instead.";
// Guests never fire billed Google searches; they browse the free curated
// attraction list or paste a link.
const GUEST_SEARCH_UNAVAILABLE_MESSAGE =
  "Google search needs a sign-in — browse the suggested places or paste a Google Maps link.";

export type PlaceSearchSelection = {
  google_place_id: string | null;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  // Photo reference from a live Place Details response; the image itself is
  // fetched once in the details step and reused as the stored place image.
  photo_name: string | null;
  photo_attribution: string | null;
  // Already-stored image from a curated candidate; needs no Google call.
  image_url: string | null;
  image_credit: string | null;
};

type Props = {
  tripId: number;
  isGuest?: boolean;
  savedPlaces: Place[];
  destinationBias: PlaceSearchBias | null;
  // Restricts live search to the trip's destination country/countries so generic
  // queries stop surfacing unrelated foreign places. Null = unrestricted.
  destinationCountryCodes: string[] | null;
  onSelectPlace: (selection: PlaceSearchSelection) => void;
  onResolveUrl: (googleMapsUrl: string) => Promise<void>;
};

export function AddPlaceSearchStep({
  tripId,
  isGuest = false,
  savedPlaces,
  destinationBias,
  destinationCountryCodes,
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
  const searchUnavailableNotice = isGuest
    ? GUEST_SEARCH_UNAVAILABLE_MESSAGE
    : unavailableMessage;
  const isSearching =
    !isPastedUrl &&
    trimmedQuery.length >= MIN_QUERY_LENGTH &&
    searchUnavailableNotice === null;
  // Catalog attractions (curated or AI-generated) fill the popover before the
  // query is long enough for live Google search, starting with the full list
  // on focus. While the catalog is in flight, a pending row holds the popover
  // open so the list doesn't pop in from nothing.
  const isBrowsingCandidates =
    !isPastedUrl && trimmedQuery.length < MIN_QUERY_LENGTH;
  const { candidates, isLoading: isCandidatesLoading } =
    useDestinationCandidates(tripId);
  const candidateMatches = isBrowsingCandidates
    ? matchDestinationCandidates(candidates, savedPlaces, trimmedQuery)
    : [];
  const showsCandidatesPending = isBrowsingCandidates && isCandidatesLoading;
  const showsCandidates = candidateMatches.length > 0 || showsCandidatesPending;
  const showPopover = isOpen && (isPastedUrl || isSearching || showsCandidates);
  // Primitive deps: a parent re-render must not reset the debounce timer just
  // because it rebuilt the bias object with the same coordinates.
  const biasLatitude = destinationBias?.latitude ?? null;
  const biasLongitude = destinationBias?.longitude ?? null;
  const countryCodesKey = (destinationCountryCodes ?? []).join(",");

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
        countryCodesKey ? countryCodesKey.split(",") : null,
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
  }, [trimmedQuery, isSearching, biasLatitude, biasLongitude, countryCodesKey]);

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
        google_place_id: details.place_id,
        name: details.name,
        latitude: details.latitude,
        longitude: details.longitude,
        google_maps_url:
          details.google_maps_url ??
          buildGoogleMapsPlaceIdUrl(details.place_id),
        photo_name: details.photo_name,
        photo_attribution: details.photo_attribution,
        image_url: null,
        image_credit: null,
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

  // Curated candidates already carry verified coordinates, so no billed
  // Place Details call is needed.
  function selectCandidate(candidate: AiDestinationCandidate) {
    if (isBusy) return;
    setIsOpen(false);
    onSelectPlace({
      google_place_id: candidate.google_place_id,
      name: candidate.name,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      google_maps_url: buildGoogleMapsPlaceLinkUrl({
        name: candidate.name,
        address: candidate.area,
        googlePlaceId: candidate.google_place_id,
      }),
      photo_name: null,
      photo_attribution: null,
      image_url: candidate.image_url,
      image_credit: candidate.image_credit,
    });
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
          placeholder={
            isGuest ? "Browse suggested places" : "Search Google Maps"
          }
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPopover}
          aria-controls={listId}
          aria-label={
            isGuest ? "Browse suggested places" : "Search Google Maps"
          }
        />
        <div className="place-search-popover" hidden={!showPopover}>
          {showsCandidates && (
            <p className="place-search-group-label">Suggested places</p>
          )}
          <div className="place-search-list" id={listId} role="listbox">
            {showsCandidates && candidateMatches.length === 0 ? (
              <p className="place-search-empty">Preparing suggestions…</p>
            ) : showsCandidates ? (
              candidateMatches.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className="place-search-option place-search-candidate-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCandidate(candidate)}
                  role="option"
                  aria-selected="false"
                  disabled={isBusy}
                >
                  <span className="place-search-candidate-thumb">
                    {candidate.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage thumbnail; fixed 40×40 box, no next/image domain config needed
                      <img
                        className="place-search-candidate-thumb-img"
                        src={candidate.image_url}
                        alt=""
                        loading="lazy"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <span
                        className="place-search-candidate-thumb-fallback"
                        aria-hidden="true"
                      >
                        <MapPinIcon />
                      </span>
                    )}
                  </span>
                  <span className="place-search-candidate-text">
                    <span className="place-search-option-name">
                      {candidate.name}
                    </span>
                    {candidate.area ? (
                      <span className="place-search-option-detail">
                        {candidate.area}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : isPastedUrl ? (
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
      {searchUnavailableNotice && (
        <p className="place-search-note" role="status">
          {searchUnavailableNotice}
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
