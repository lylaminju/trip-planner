"use client";

import { useEffect, useRef, useState } from "react";

import {
  DestinationSearchUnavailableError,
  fetchDestinationDetails,
  fetchDestinationSuggestions,
  type DestinationDetails,
  type DestinationSuggestion,
  type PlaceSearchBias,
} from "@/lib/places-api";

// Below this length autocomplete predictions are too broad to be useful, so we
// never spend an autocomplete call on them. Mirrors the server-side floor.
export const MIN_PLACE_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;

export type PlaceSearch = {
  suggestions: DestinationSuggestion[];
  isLoading: boolean;
  // True once live search is blocked (budget exhausted or per-user cap); the
  // caller falls back to pasting a Google Maps link.
  isUnavailable: boolean;
  // Resolves a picked suggestion to its details (one billed Place Details call)
  // and closes the billed autocomplete session.
  resolvePlace: (placeId: string) => Promise<DestinationDetails>;
};

// Location-biased Google Places search shared by place pickers: debounced
// autocomplete with a billed session token, plus a details resolve for the
// picked suggestion. The caller owns the query input and gates search with
// `active` so URLs and short queries spend no budget.
export function usePlaceSearch(input: {
  query: string;
  active: boolean;
  bias: PlaceSearchBias | null;
  countryCodes: string[] | null;
}): PlaceSearch {
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const requestIdRef = useRef(0);

  const trimmedQuery = input.query.trim();
  const shouldSearch =
    input.active &&
    !isUnavailable &&
    trimmedQuery.length >= MIN_PLACE_QUERY_LENGTH;
  // Primitive deps: a parent re-render must not reset the debounce timer just
  // because it rebuilt the bias object with the same coordinates.
  const biasLatitude = input.bias?.latitude ?? null;
  const biasLongitude = input.bias?.longitude ?? null;
  const countryCodesKey = (input.countryCodes ?? []).join(",");

  useEffect(() => {
    if (!shouldSearch) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = (requestIdRef.current += 1);
    setIsLoading(true);
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
            setIsUnavailable(true);
            return;
          }
          setSuggestions([]);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setIsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    shouldSearch,
    trimmedQuery,
    biasLatitude,
    biasLongitude,
    countryCodesKey,
  ]);

  async function resolvePlace(placeId: string): Promise<DestinationDetails> {
    try {
      return await fetchDestinationDetails(placeId, sessionTokenRef.current);
    } catch (reason) {
      if (reason instanceof DestinationSearchUnavailableError) {
        setIsUnavailable(true);
      }
      throw reason;
    } finally {
      // The details call ends the billed autocomplete session either way.
      sessionTokenRef.current = crypto.randomUUID();
      requestIdRef.current += 1;
    }
  }

  return { suggestions, isLoading, isUnavailable, resolvePlace };
}
