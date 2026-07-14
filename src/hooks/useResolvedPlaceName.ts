import { useEffect, useState } from "react";

import { resolvePlaceRequest } from "@/lib/planner-api";

const RESOLVE_DEBOUNCE_MS = 800;
const RESOLVED_NAME_CACHE_LIMIT = 50;

const resolvedNameCache = new Map<string, string>();

export type ResolvedPlacePreview =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "resolved"; name: string }
  | { status: "error"; message: string };

export function useResolvedPlaceName(
  tripId: number,
  googleMapsUrl: string,
): ResolvedPlacePreview {
  const [preview, setPreview] = useState<ResolvedPlacePreview>({
    status: "idle",
  });

  useEffect(() => {
    const trimmed = googleMapsUrl.trim();
    if (!looksLikeUrl(trimmed)) {
      setPreview({ status: "idle" });
      return;
    }

    const cacheKey = `${tripId}:${trimmed}`;
    const cachedName = resolvedNameCache.get(cacheKey);
    if (cachedName !== undefined) {
      setPreview({ status: "resolved", name: cachedName });
      return;
    }

    let cancelled = false;
    setPreview({ status: "resolving" });
    const timer = setTimeout(async () => {
      try {
        const resolved = await resolvePlaceRequest(tripId, trimmed);
        const name = resolved.name ?? "Location found";
        if (resolvedNameCache.size >= RESOLVED_NAME_CACHE_LIMIT) {
          resolvedNameCache.clear();
        }
        resolvedNameCache.set(cacheKey, name);
        if (!cancelled) {
          setPreview({ status: "resolved", name });
        }
      } catch {
        if (!cancelled) {
          setPreview({
            status: "error",
            message: "Couldn't read that link — double-check it.",
          });
        }
      }
    }, RESOLVE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tripId, googleMapsUrl]);

  return preview;
}

function looksLikeUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}
