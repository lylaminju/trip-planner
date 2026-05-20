import { parseGoogleMapsUrl } from "@/lib/google-maps-url";
import { GoogleMapsUrlUpstreamError, GoogleMapsUrlValidationError } from "@/server/errors";

export type ResolvedGoogleMapsUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolveGoogleMapsUrl(rawUrl: string): Promise<ResolvedGoogleMapsUrl> {
  const direct = parseGoogleMapsUrl(rawUrl);
  if (isResolvedGoogleMapsUrl(direct)) {
    return { google_maps_url: rawUrl, ...direct };
  }

  const shortUrl = parseUrl(rawUrl);
  if (!shortUrl || !isAllowedGoogleShortUrl(shortUrl)) {
    throw new GoogleMapsUrlValidationError("Unsupported Google Maps URL host");
  }

  if (shortUrl.protocol !== "https:") {
    throw new GoogleMapsUrlValidationError("Google Maps short URLs must use https");
  }

  const finalUrl = await resolveRedirect(shortUrl.toString());
  const parsed = parseGoogleMapsUrl(finalUrl);
  if (!isResolvedGoogleMapsUrl(parsed)) {
    throw new GoogleMapsUrlValidationError("Resolved Google Maps URL was not parseable");
  }

  return {
    google_maps_url: finalUrl,
    ...parsed,
  };
}

async function resolveRedirect(rawUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(GOOGLE_REDIRECT_TIMEOUT_ERROR));
  }, GOOGLE_REDIRECT_TIMEOUT_MS);

  try {
    let currentUrl = rawUrl;

    for (let hop = 0; hop <= GOOGLE_REDIRECT_MAX_HOPS; hop += 1) {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "user-agent": "trip-planner-local/0.1",
        },
        signal: controller.signal,
      });

      if (isRedirectStatus(response.status)) {
        if (hop === GOOGLE_REDIRECT_MAX_HOPS) {
          throw new GoogleMapsUrlUpstreamError(GOOGLE_REDIRECT_TOO_MANY_HOPS_ERROR, 502);
        }

        currentUrl = resolveAllowedGoogleRedirectUrl(currentUrl, response).toString();
        continue;
      }

      if (!response.ok) {
        throw new GoogleMapsUrlUpstreamError(
          `Google Maps URL request failed: ${response.status} ${response.statusText}`,
          502,
        );
      }

      return response.url || currentUrl;
    }

    throw new GoogleMapsUrlUpstreamError(GOOGLE_REDIRECT_TOO_MANY_HOPS_ERROR, 502);
  } catch (error) {
    if (controller.signal.aborted) {
      const reason =
        controller.signal.reason instanceof Error
          ? controller.signal.reason.message
          : GOOGLE_REDIRECT_TIMEOUT_ERROR;
      throw new GoogleMapsUrlUpstreamError(reason, 504);
    }

    if (
      error instanceof GoogleMapsUrlValidationError ||
      error instanceof GoogleMapsUrlUpstreamError
    ) {
      throw error;
    }

    throw new GoogleMapsUrlUpstreamError(GOOGLE_REDIRECT_FETCH_ERROR, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isAllowedGoogleShortUrl(url: URL): boolean {
  return ALLOWED_GOOGLE_SHORT_HOSTS.has(url.hostname.toLowerCase());
}

function resolveAllowedGoogleRedirectUrl(currentUrl: string, response: Response): URL {
  const location = response.headers.get("location");
  if (!location) {
    throw new GoogleMapsUrlUpstreamError("Google Maps redirect response missing Location header", 502);
  }

  const nextUrl = new URL(location, currentUrl);
  if (nextUrl.protocol !== "https:") {
    throw new GoogleMapsUrlValidationError("Google Maps redirects must use https");
  }

  if (!ALLOWED_GOOGLE_REDIRECT_HOSTS.has(nextUrl.hostname.toLowerCase())) {
    throw new GoogleMapsUrlValidationError("Unsupported Google Maps redirect host");
  }

  return nextUrl;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function isResolvedGoogleMapsUrl(parsed: ReturnType<typeof parseGoogleMapsUrl>): boolean {
  const hasCoordinates = parsed.latitude !== null && parsed.longitude !== null;
  return hasCoordinates || parsed.name !== null;
}

const ALLOWED_GOOGLE_SHORT_HOSTS = new Set(["maps.app.goo.gl"]);
const ALLOWED_GOOGLE_REDIRECT_HOSTS = new Set([
  "maps.app.goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "google.ca",
  "www.google.ca",
  "maps.google.ca",
  "google.co.uk",
  "www.google.co.uk",
  "maps.google.co.uk",
  "google.co.jp",
  "www.google.co.jp",
  "maps.google.co.jp",
]);
const GOOGLE_REDIRECT_MAX_HOPS = 5;
const GOOGLE_REDIRECT_TIMEOUT_MS = 5_000;
const GOOGLE_REDIRECT_TIMEOUT_ERROR = "Google Maps URL resolution timed out";
const GOOGLE_REDIRECT_TOO_MANY_HOPS_ERROR = "Google Maps URL redirected too many times";
const GOOGLE_REDIRECT_FETCH_ERROR = "Google Maps URL request failed";
