import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TripPlannerView } from "@/components/TripPlannerView";
import type { ItineraryView, PlannerSnapshot } from "@/lib/types";

const OPENING_HOURS_WARNING =
  "AI itinerary created. Opening hours may change, so check Google Maps or the venue before you go.";

describe("TripPlannerView", () => {
  it("renders the AI opening-hours warning after generation", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TripPlannerView,
        tripPlannerViewProps({ aiGenerationToast: OPENING_HOURS_WARNING }),
      ),
    );

    expect(markup).toContain('class="ai-generation-toast"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain(OPENING_HOURS_WARNING);
  });
});

function tripPlannerViewProps(overrides: Record<string, unknown> = {}) {
  return {
    mobileSheetState: "half" as const,
    isPlannerPanelExpanded: false,
    tripTitle: "New York City",
    tripPeriodLabel: "May 27 - 28, 2026",
    destinationFocus: null,
    itinerary: itinerary(),
    plannerSnapshot: plannerSnapshot(),
    activeItemId: null,
    activeCanonicalPlaceId: null,
    activeSegmentId: null,
    activeDate: null,
    collapsedDates: new Set<string>(),
    routeGeometries: new Map(),
    routeGeometryError: null,
    error: null,
    aiGenerationToast: null,
    exportFeedback: null,
    canEdit: true,
    canEditTripMetadata: true,
    canAddVisits: true,
    deletingPlaceIds: new Set<number>(),
    deletingItineraryItemIds: new Set<number>(),
    currentLocationPosition: null,
    currentLocationToast: null,
    canShowCurrentLocation: false,
    isCurrentLocationEnabled: false,
    isAdding: false,
    editingPlace: null,
    editingItem: null,
    addingVisitPlace: null,
    addPlaceVisitDate: null,
    editingTripForm: null,
    editTripError: null,
    isSavingTrip: false,
    aiPlanningWizard: {
      isOpen: false,
      isLoading: false,
      isGenerating: false,
      setup: null,
      error: null,
    },
    visitDateOptions: [],
    onTogglePlannerExpanded: vi.fn(),
    onPlanWithAi: vi.fn(),
    onMobileSheetStateChange: vi.fn(),
    onOpenAddModal: vi.fn(),
    onOpenEditTripModal: vi.fn(),
    onCopyMarkdownExport: vi.fn(),
    onDownloadMarkdownExport: vi.fn(),
    onOpenAddVisitModal: vi.fn(),
    onOpenEditModal: vi.fn(),
    onOpenEditItemModal: vi.fn(),
    onDeletePlace: vi.fn().mockResolvedValue(undefined),
    onSelectItem: vi.fn(),
    onSelectCanonicalPlace: vi.fn(),
    onToggleSegmentSelection: vi.fn(),
    onToggleDateCollapsed: vi.fn(),
    onSelectDate: vi.fn(),
    onClearSelection: vi.fn(),
    onSchedulePlace: vi.fn().mockResolvedValue(undefined),
    onScheduleItineraryItem: vi.fn().mockResolvedValue(undefined),
    onDeleteItineraryItem: vi.fn().mockResolvedValue(undefined),
    onUpdateSegmentMode: vi.fn().mockResolvedValue(undefined),
    onToggleCurrentLocation: vi.fn(),
    onCloseModal: vi.fn(),
    onResolvePlaceUrl: vi.fn().mockResolvedValue({
      google_maps_url: "https://maps.app.goo.gl/example",
      name: "Example place",
      latitude: 0,
      longitude: 0,
    }),
    onSavePlace: vi.fn().mockResolvedValue(undefined),
    onSaveItineraryItem: vi.fn().mockResolvedValue(undefined),
    onCreateItineraryItem: vi.fn().mockResolvedValue(undefined),
    onSetEditingTripForm: vi.fn(),
    onSubmitEditTrip: vi.fn(),
    onSetError: vi.fn(),
    onCloseAiPlanningWizard: vi.fn(),
    onCreateAiItinerary: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function itinerary(): ItineraryView {
  return {
    days: [],
    unscheduled: [],
  };
}

function plannerSnapshot(): PlannerSnapshot {
  return {
    places: [],
    itineraryItems: [],
    routeSegments: [],
  };
}
