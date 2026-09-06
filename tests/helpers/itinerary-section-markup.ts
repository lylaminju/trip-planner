import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";

import { ItinerarySection } from "@/components/planner-panel/ItinerarySection";
import type { ItineraryView } from "@/lib/types";

import { buildPlace } from "./fixtures";

type ItinerarySectionProps = Parameters<typeof ItinerarySection>[0];

function defaultItinerary(): ItineraryView {
  return {
    days: [
      {
        date: "2026-06-01",
        color: "var(--accent)",
        items: [],
        segments: [],
      },
    ],
    unscheduled: [buildPlace()],
  };
}

export function renderItinerarySection(
  overrides: Partial<ItinerarySectionProps> = {},
): string {
  return renderToStaticMarkup(
    createElement(ItinerarySection, {
      itinerary: defaultItinerary(),
      activePlaceId: null,
      activeCanonicalPlaceId: null,
      activeSegmentId: null,
      activeDate: null,
      collapsedDates: new Set<string>(),
      routeGeometries: new Map(),
      markerLabels: new Map(),
      canEdit: true,
      canAddVisits: true,
      deletingPlaceIds: new Set<number>(),
      deletingItineraryItemIds: new Set<number>(),
      isExpanded: false,
      isUnscheduledOpen: true,
      showRouteSegments: true,
      dragPreview: null,
      draggingItem: null,
      dragRowHeight: 64,
      exportFeedback: null,
      onStartItemDrag: vi.fn(),
      onToggleUnscheduledOpen: vi.fn(),
      onToggleRouteSegments: vi.fn(),
      onCopyExport: vi.fn(),
      onDownloadExport: vi.fn(),
      onToggleDatePlacePicker: vi.fn(),
      onSelectPlace: vi.fn(),
      onSelectCanonicalPlace: vi.fn(),
      onSelectSegment: vi.fn(),
      onToggleDateCollapsed: vi.fn(),
      onToggleAllDaysCollapsed: vi.fn(),
      onSelectDate: vi.fn(),
      onAddVisit: vi.fn(),
      onEdit: vi.fn(),
      onDuplicateItem: vi.fn(),
      onEditItem: vi.fn(),
      onDelete: vi.fn(),
      onDeleteItem: vi.fn(),
      onDeleteAllItems: vi.fn(),
      onScheduleItem: vi.fn(),
      onModeChange: vi.fn(),
      onConfirmDeletion: vi.fn(),
      ...overrides,
    }),
  );
}
