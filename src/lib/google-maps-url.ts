export type ParsedGoogleMapsUrl = {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function parseGoogleMapsUrl(rawUrl: string): ParsedGoogleMapsUrl {
  const parsed = safeUrl(rawUrl);
  if (!parsed || !isRecognizedGoogleMapsHost(parsed)) {
    return {
      name: null,
      latitude: null,
      longitude: null,
    };
  }

  const source = parsed
    ? `${safeDecode(parsed.pathname)}${safeDecode(parsed.hash)}`
    : rawUrl;
  const atMatch = source.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?=$|[,/?#])/,
  );
  const dataMatch = source.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)(?=$|[!/?#&,])/,
  );
  const match = dataMatch ?? atMatch;

  return {
    name: extractPlaceName(parsed),
    latitude: match ? Number(match[1]) : null,
    longitude: match ? Number(match[2]) : null,
  };
}

function extractPlaceName(url: URL | null): string | null {
  if (!url) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const placeIndex = parts.findIndex((part) => part === "place");
  const rawName = placeIndex >= 0 ? parts[placeIndex + 1] : null;

  if (!rawName) return null;

  return safeDecode(rawName).replace(/\+/g, " ").trim() || null;
}

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isRecognizedGoogleMapsHost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  const baseDomain = stripRecognizedPrefix(hostname);

  return baseDomain !== null && RECOGNIZED_GOOGLE_MAPS_DOMAINS.has(baseDomain);
}

function stripRecognizedPrefix(hostname: string): string | null {
  if (hostname.startsWith("www.")) {
    return hostname.slice("www.".length);
  }

  if (hostname.startsWith("maps.")) {
    return hostname.slice("maps.".length);
  }

  return hostname;
}

const RECOGNIZED_GOOGLE_MAPS_DOMAINS = new Set([
  "google.com",
  "google.ca",
  "google.co.uk",
  "google.co.jp",
]);
