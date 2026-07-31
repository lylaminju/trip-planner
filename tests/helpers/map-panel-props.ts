import type { ComponentProps } from "react";
import { vi } from "vitest";

import type { MapPanel } from "@/components/MapPanel";
import type { ItineraryView } from "@/lib/types";

export function buildMapPanelProps(
  itinerary: ItineraryView,
): ComponentProps<typeof MapPanel> {
  return {
    itinerary,
    destinationFocus: null,
    routeSegments: [],
    selection: {
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
      selectItem: vi.fn(),
      toggleSegmentSelection: vi.fn(),
      clearSelection: vi.fn(),
    },
    modals: {
      openAddModal: vi.fn(),
      openAddModalWithSelection: vi.fn(),
      openEditModal: vi.fn(),
      openEditItemModal: vi.fn(),
    },
    mobileSheetState: "half",
    routeGeometries: new Map(),
    routeGeometryError: null,
    currentLocation: {
      currentLocationPosition: null,
      currentLocationToast: null,
      isCurrentLocationEnabled: false,
      toggleCurrentLocation: vi.fn(),
    },
    canShowCurrentLocation: false,
    canEdit: true,
  };
}
