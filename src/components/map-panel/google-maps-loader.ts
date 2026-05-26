const GOOGLE_MAPS_CALLBACK = "__tripPlannerGoogleMapsReady";
let googleMapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (isGoogleMapsReady()) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollId: number | null = null;
    let timeoutId: number | null = null;

    function cleanup() {
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      delete window[GOOGLE_MAPS_CALLBACK];
    }

    function finish() {
      if (settled || !isGoogleMapsReady()) return;

      settled = true;
      cleanup();
      resolve();
    }

    function fail() {
      if (settled) return;

      settled = true;
      googleMapsLoadPromise = null;
      cleanup();
      reject(new Error("Google Maps failed to load"));
    }

    window[GOOGLE_MAPS_CALLBACK] = finish;
    pollId = window.setInterval(finish, 50);
    timeoutId = window.setTimeout(fail, 10000);

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps]",
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function isGoogleMapsReady(): boolean {
  return Boolean(
    window.google?.maps?.Map &&
    window.google.maps.marker?.AdvancedMarkerElement,
  );
}

declare global {
  interface Window {
    google?: any;
    __tripPlannerGoogleMapsReady?: () => void;
  }
}
