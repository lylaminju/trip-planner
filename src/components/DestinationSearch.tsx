"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  filterDestinationOptions,
  findDestinationOption,
} from "@/lib/destination-options";
import { errorMessage } from "@/lib/error-message";
import {
  DestinationSearchUnavailableError,
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  type DestinationSuggestion,
} from "@/lib/places-api";

import { DestinationOptionRow } from "./DestinationOptionRow";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

export type GoogleDestinationSelection = {
  destination: string;
  latitude: number;
  longitude: number;
};

export function DestinationSearch(props: {
  value: string;
  onChange: (destination: string) => void;
  onSelectGoogle: (selection: GoogleDestinationSelection) => void;
  inputId?: string;
  leadingIcon?: ReactNode;
  showPreview?: boolean;
}) {
  const generatedInputId = useId();
  const listId = useId();
  const inputId = props.inputId ?? generatedInputId;

  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    null,
  );
  const [errorText, setErrorText] = useState<string | null>(null);

  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const requestIdRef = useRef(0);

  const trimmedValue = props.value.trim();
  const isSearching =
    trimmedValue.length >= MIN_QUERY_LENGTH && unavailableMessage === null;

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
      fetchDestinationSuggestions(trimmedValue, sessionTokenRef.current)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(results);
        })
        .catch((reason) => {
          if (requestId !== requestIdRef.current) return;
          if (reason instanceof DestinationSearchUnavailableError) {
            setUnavailableMessage(reason.message);
            return;
          }
          setErrorText(errorMessage(reason, "Destination search failed."));
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setIsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedValue, isSearching]);

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

  function selectCurated(destination: string) {
    props.onChange(destination);
    resetSession();
    setIsOpen(false);
  }

  async function selectGoogleSuggestion(suggestion: DestinationSuggestion) {
    setIsOpen(false);
    setErrorText(null);
    try {
      const details = await fetchDestinationDetails(
        suggestion.place_id,
        sessionTokenRef.current,
      );
      props.onSelectGoogle({
        destination: details.name,
        latitude: details.latitude,
        longitude: details.longitude,
      });
    } catch (reason) {
      if (reason instanceof DestinationSearchUnavailableError) {
        setUnavailableMessage(reason.message);
      } else {
        setErrorText(errorMessage(reason, "Could not load that place."));
      }
      // Keep the typed name so the user can retry or pick a curated match.
      props.onChange(suggestion.primary_text);
    } finally {
      resetSession();
    }
  }

  const matchedOption = findDestinationOption(trimmedValue);
  const curatedOptions = filterDestinationOptions(props.value);
  const showCustomOption = Boolean(trimmedValue && !matchedOption);

  const wrapperClassName = props.leadingIcon
    ? "destination-combobox destination-combobox-has-icon"
    : "destination-combobox";

  return (
    <div className={wrapperClassName} onBlur={closeOnBlur}>
      {props.leadingIcon ? (
        <span className="destination-combobox-icon" aria-hidden="true">
          {props.leadingIcon}
        </span>
      ) : null}
      <input
        id={inputId}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.currentTarget.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search any place on Google Maps"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        required
      />

      <div className="destination-combobox-popover" hidden={!isOpen}>
        <div className="destination-combobox-list" id={listId} role="listbox">
          {unavailableMessage ? (
            <p className="destination-combobox-note" role="status">
              {unavailableMessage}
            </p>
          ) : null}
          {errorText ? (
            <p className="destination-combobox-note" role="alert">
              {errorText}
            </p>
          ) : null}

          {isSearching ? (
            <GoogleSuggestions
              suggestions={suggestions}
              isLoading={isLoading}
              onSelect={selectGoogleSuggestion}
            />
          ) : (
            <>
              {curatedOptions.map((option) => (
                <DestinationOptionRow
                  key={option.slug}
                  option={option}
                  isSelected={matchedOption?.slug === option.slug}
                  showPreview={props.showPreview}
                  onSelect={selectCurated}
                />
              ))}
              {showCustomOption ? (
                <button
                  type="button"
                  className="destination-combobox-option destination-combobox-custom-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCurated(trimmedValue)}
                  role="option"
                  aria-selected="false"
                >
                  <span className="destination-combobox-option-name">
                    Use &quot;{trimmedValue}&quot; as custom destination
                  </span>
                </button>
              ) : null}
              {!curatedOptions.length && !showCustomOption ? (
                <p className="destination-combobox-empty">
                  No destinations found.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleSuggestions(props: {
  suggestions: DestinationSuggestion[];
  isLoading: boolean;
  onSelect: (suggestion: DestinationSuggestion) => void;
}) {
  if (props.suggestions.length === 0) {
    return (
      <p className="destination-combobox-empty">
        {props.isLoading ? "Searching…" : "No matching places."}
      </p>
    );
  }

  return (
    <>
      {props.suggestions.map((suggestion) => (
        <button
          type="button"
          key={suggestion.place_id}
          className="destination-combobox-option"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onSelect(suggestion)}
          role="option"
          aria-selected="false"
        >
          <span className="destination-combobox-option-text">
            <span className="destination-combobox-option-name">
              {suggestion.primary_text}
            </span>
            {suggestion.secondary_text ? (
              <span className="destination-combobox-option-country">
                {suggestion.secondary_text}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </>
  );
}
