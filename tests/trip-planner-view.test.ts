import { readFileSync } from "node:fs";
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

  it("shows the guest banner with sign-in and invite links only in guest mode", () => {
    const guestMarkup = renderToStaticMarkup(
      createElement(TripPlannerView, tripPlannerViewProps({ isGuest: true })),
    );
    expect(guestMarkup).toContain('class="guest-mode-banner"');
    expect(guestMarkup).toContain('href="/sign-in"');
    expect(guestMarkup).toContain("mailto:");

    const memberMarkup = renderToStaticMarkup(
      createElement(TripPlannerView, tripPlannerViewProps({ isGuest: false })),
    );
    expect(memberMarkup).not.toContain('class="guest-mode-banner"');
  });

  it("hides the guest banner while the expanded planner puts its controls underneath", () => {
    const layoutCss = readFileSync("src/styles/layout.css", "utf8");

    expect(layoutCss).toMatch(
      /\.app-shell\.planner-panel-expanded \.guest-mode-banner \{\s*display: none;/,
    );
  });

  it("points the header back-link home for guests and to the dashboard for members", () => {
    const guestMarkup = renderToStaticMarkup(
      createElement(TripPlannerView, tripPlannerViewProps({ isGuest: true })),
    );
    expect(guestMarkup).toContain(
      '<a class="app-header-dashboard-link" href="/"',
    );
    expect(guestMarkup).toContain("<span>Home</span>");

    const memberMarkup = renderToStaticMarkup(
      createElement(TripPlannerView, tripPlannerViewProps({ isGuest: false })),
    );
    expect(memberMarkup).toContain(
      '<a class="app-header-dashboard-link" href="/trips"',
    );
    expect(memberMarkup).toContain("<span>Trips</span>");
  });
});

function tripPlannerViewProps(overrides: Record<string, unknown> = {}) {
  return {
    tripId: 1,
    isGuest: false,
    mobileSheetState: "half" as const,
    isPlannerPanelExpanded: false,
    tripTitle: "New York City",
    tripPeriodLabel: "May 27 - 28, 2026",
    members: [],
    currentUserId: "user-1",
    destinationFocus: null,
    destinationCountryCodes: null,
    itinerary: itinerary(),
    plannerSnapshot: plannerSnapshot(),
    selection: {
      activeItemId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
      selectItem: vi.fn(),
      selectCanonicalPlace: vi.fn(),
      toggleSegmentSelection: vi.fn(),
      selectDate: vi.fn(),
      clearSelection: vi.fn(),
      clearActiveCanonicalPlace: vi.fn(),
      clearDeletedPlaceSelection: vi.fn(),
      clearDeletedItineraryItemSelection: vi.fn(),
    },
    mutations: {
      deletingPlaceIds: new Set<number>(),
      deletingItineraryItemIds: new Set<number>(),
      isDeletingAllItineraryItems: false,
      isDeletingAllPlaces: false,
      resolvePlace: vi.fn().mockResolvedValue({
        google_maps_url: "https://maps.app.goo.gl/example",
        name: "Example place",
        latitude: 0,
        longitude: 0,
      }),
      savePlace: vi.fn().mockResolvedValue(undefined),
      saveItineraryItem: vi.fn().mockResolvedValue(undefined),
      deletePlace: vi.fn().mockResolvedValue(undefined),
      deleteAllPlaces: vi.fn().mockResolvedValue(undefined),
      schedulePlace: vi.fn().mockResolvedValue(undefined),
      createItineraryItem: vi.fn().mockResolvedValue(undefined),
      scheduleItineraryItem: vi.fn().mockResolvedValue(undefined),
      deleteItineraryItem: vi.fn().mockResolvedValue(undefined),
      deleteAllItineraryItems: vi.fn().mockResolvedValue(undefined),
      updateSegmentMode: vi.fn().mockResolvedValue(undefined),
    },
    modals: {
      addPlaceSelection: null,
      addPlaceVisitDate: null,
      addingVisitPlace: null,
      editingItem: null,
      duplicatingItem: null,
      editingPlace: null,
      editingTripForm: null,
      isAdding: false,
      closeModal: vi.fn(),
      openAddModal: vi.fn(),
      openAddModalWithSelection: vi.fn(),
      openAddVisitModal: vi.fn(),
      openEditItemModal: vi.fn(),
      openDuplicateItemModal: vi.fn(),
      openEditModal: vi.fn(),
      openEditTripModal: vi.fn(),
      setAddingVisitPlace: vi.fn(),
      setEditingItem: vi.fn(),
      setEditingTripForm: vi.fn(),
    },
    permissions: {
      canEdit: true,
      canEditTripMetadata: true,
      canAddVisits: true,
    },
    currentLocation: {
      currentLocationPosition: null,
      currentLocationToast: null,
      isCurrentLocationEnabled: false,
      toggleCurrentLocation: vi.fn(),
    },
    canShowCurrentLocation: false,
    collapsedDates: new Set<string>(),
    routeGeometries: new Map(),
    routeGeometryError: null,
    error: null,
    aiGenerationToast: null,
    exportFeedback: null,
    editTripError: null,
    isSavingTrip: false,
    aiPlanningWizard: {
      isOpen: false,
      isLoading: false,
      catalogStatus: "ready" as const,
      hubsStatus: "ready" as const,
      isGenerating: false,
      setup: null,
      error: null,
    },
    visitDateOptions: [],
    onTogglePlannerExpanded: vi.fn(),
    onPlanWithAi: vi.fn(),
    onMobileSheetStateChange: vi.fn(),
    onManageMembers: vi.fn(),
    onCopyMarkdownExport: vi.fn(),
    onDownloadMarkdownExport: vi.fn(),
    onToggleDateCollapsed: vi.fn(),
    onSubmitEditTrip: vi.fn(),
    onCloseAiPlanningWizard: vi.fn(),
    onCreateAiItinerary: vi.fn().mockResolvedValue(undefined),
    onRetryAiPlanningLoad: vi.fn(),
    onRetryAiCatalogPrepare: vi.fn(),
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
