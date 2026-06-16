import { useEffect, useRef, useState } from "react";

import {
  startCurrentLocationWatch,
  type CurrentLocationPosition,
} from "@/lib/current-location";

type CurrentLocationControl = {
  currentLocationPosition: CurrentLocationPosition | null;
  currentLocationToast: string | null;
  isCurrentLocationEnabled: boolean;
  toggleCurrentLocation: () => void;
};

export function useCurrentLocationControl(
  canShowCurrentLocation: boolean,
): CurrentLocationControl {
  const [isCurrentLocationEnabled, setIsCurrentLocationEnabled] =
    useState(false);
  const [currentLocationPosition, setCurrentLocationPosition] =
    useState<CurrentLocationPosition | null>(null);
  const [currentLocationToast, setCurrentLocationToast] = useState<
    string | null
  >(null);
  const currentLocationStopRef = useRef<(() => void) | null>(null);
  const currentLocationToastTimeoutRef = useRef<number | null>(null);

  function clearCurrentLocationToast() {
    if (currentLocationToastTimeoutRef.current !== null) {
      window.clearTimeout(currentLocationToastTimeoutRef.current);
      currentLocationToastTimeoutRef.current = null;
    }
    setCurrentLocationToast(null);
  }

  function showCurrentLocationToast(message: string) {
    clearCurrentLocationToast();
    setCurrentLocationToast(message);
    currentLocationToastTimeoutRef.current = window.setTimeout(() => {
      setCurrentLocationToast(null);
      currentLocationToastTimeoutRef.current = null;
    }, 3500);
  }

  function stopCurrentLocationWatch() {
    currentLocationStopRef.current?.();
    currentLocationStopRef.current = null;
    setIsCurrentLocationEnabled(false);
    setCurrentLocationPosition(null);
  }

  function toggleCurrentLocation() {
    if (isCurrentLocationEnabled) {
      stopCurrentLocationWatch();
      clearCurrentLocationToast();
      return;
    }

    clearCurrentLocationToast();

    if (!canShowCurrentLocation) {
      return;
    }

    if (!navigator.geolocation) {
      showCurrentLocationToast("Location is not supported by this browser.");
      return;
    }

    try {
      currentLocationStopRef.current = startCurrentLocationWatch(
        navigator.geolocation,
        (position) => {
          setCurrentLocationPosition(position);
          setIsCurrentLocationEnabled(true);
          clearCurrentLocationToast();
        },
        (reason) => {
          stopCurrentLocationWatch();
          showCurrentLocationToast(currentLocationErrorMessage(reason));
        },
      );
      setIsCurrentLocationEnabled(true);
    } catch (reason) {
      stopCurrentLocationWatch();
      showCurrentLocationToast(currentLocationErrorMessage(reason));
    }
  }

  useEffect(() => {
    if (canShowCurrentLocation) {
      return;
    }

    stopCurrentLocationWatch();
    clearCurrentLocationToast();
  }, [canShowCurrentLocation]);

  useEffect(() => {
    return () => {
      currentLocationStopRef.current?.();
      if (currentLocationToastTimeoutRef.current !== null) {
        window.clearTimeout(currentLocationToastTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentLocationPosition,
    currentLocationToast,
    isCurrentLocationEnabled,
    toggleCurrentLocation,
  };
}

function currentLocationErrorMessage(reason: unknown): string {
  if (isGeolocationPermissionDenied(reason)) {
    return "Location permission was denied.";
  }

  return "Unable to access current location.";
}

function isGeolocationPermissionDenied(reason: unknown): boolean {
  return (
    typeof reason === "object" &&
    reason !== null &&
    "code" in reason &&
    reason.code === 1
  );
}
