"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useMobileSheetDrag } from "@/hooks/useMobileSheetDrag";
import type { TripPlannerModals } from "@/hooks/useTripPlannerModals";
import type { TripPlannerMutations } from "@/hooks/useTripPlannerMutations";
import type { TripPlannerSelection } from "@/hooks/useTripPlannerSelection";
import { buildTimedMarkerLabels } from "@/lib/map-marker-labels";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type {
  ItineraryView,
  Place,
  RouteGeometry,
  TripMemberSummary,
} from "@/lib/types";

import { DatePlacePicker } from "./planner-panel/DatePlacePicker";
import { FeedbackButton } from "./FeedbackButton";
import {
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  UserPlusIcon,
} from "./Icons";
import { ItinerarySection } from "./planner-panel/ItinerarySection";
import { PlacesSection } from "./planner-panel/PlacesSection";
import { PlanWithAiButton } from "./PlanWithAiButton";
import { TripMemberBadges } from "./TripMemberBadges";

type PlannerSelectionProps = Pick<
  TripPlannerSelection,
  | "activeItemId"
  | "activeCanonicalPlaceId"
  | "activeSegmentId"
  | "activeDate"
  | "selectItem"
  | "selectCanonicalPlace"
  | "toggleSegmentSelection"
  | "selectDate"
  | "clearSelection"
>;

type PlannerMutationsProps = Pick<
  TripPlannerMutations,
  | "deletingPlaceIds"
  | "deletingItineraryItemIds"
  | "deletePlace"
  | "deleteAllPlaces"
  | "schedulePlace"
  | "scheduleItineraryItem"
  | "deleteItineraryItem"
  | "deleteAllItineraryItems"
  | "updateSegmentMode"
>;

type PlannerModalsProps = Pick<
  TripPlannerModals,
  | "openAddModal"
  | "openAddVisitModal"
  | "openEditModal"
  | "openEditItemModal"
  | "openDuplicateItemModal"
>;

type Props = {
  title: string;
  tripPeriodLabel: string | null;
  members: TripMemberSummary[];
  currentUserId: string;
  itinerary: ItineraryView;
  places: Place[];
  selection: PlannerSelectionProps;
  mutations: PlannerMutationsProps;
  modals: PlannerModalsProps;
  collapsedDates: ReadonlySet<string>;
  routeGeometries: Map<number, RouteGeometry>;
  error: string | null;
  exportFeedback: {
    action: "copy" | "download";
    kind: "error" | "success";
    label: string;
  } | null;
  isExpanded: boolean;
  isGuest: boolean;
  mobileSheetState: MobileSheetState;
  canEdit: boolean;
  canAddVisits: boolean;
  onToggleExpanded: () => void;
  onPlanWithAi?: () => void;
  aiPlanMutedHint?: string | null;
  onMobileSheetStateChange: (state: MobileSheetState) => void;
  onEditTrip?: () => void;
  onManageMembers?: () => void;
  onCopyExport: () => void;
  onDownloadExport: () => void;
  onToggleDateCollapsed: (date: string) => void;
  resizeHandle?: ReactNode;
};

type PickerState = {
  date: string;
  left: number;
  top: number;
};

export function PlannerPanel(props: Props) {
  const [isUnscheduledOpen, setIsUnscheduledOpen] = useState(false);
  const [isPlacesOpen, setIsPlacesOpen] = useState(false);
  const [showRouteSegments, setShowRouteSegments] = useState(true);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const mobileSheetDrag = useMobileSheetDrag({
    state: props.mobileSheetState,
    onStateChange: props.onMobileSheetStateChange,
  });
  const markerLabels = useMemo(
    () => buildTimedMarkerLabels(props.itinerary),
    [props.itinerary],
  );
  const viewToggleLabel = props.isExpanded ? "Collapse" : "Expand";
  const viewToggleDescription = props.isExpanded
    ? "Collapse planner and show map"
    : "Expand planner and hide map";

  function toggleDatePlacePicker(
    event: MouseEvent<HTMLButtonElement>,
    date: string,
  ) {
    const bucket = event.currentTarget.closest(".day-block");
    const rect = (bucket ?? event.currentTarget).getBoundingClientRect();
    const width = 320;
    const gap = 10;
    const left = Math.min(rect.right + gap, window.innerWidth - width - 16);
    const maxTop = Math.max(16, window.innerHeight - 380);
    const top = Math.min(Math.max(rect.top + 10, 16), maxTop);

    setPicker((current) => {
      if (current?.date === date) return null;

      return {
        date,
        left: Math.max(16, left),
        top,
      };
    });
  }

  function clearSelectionOnBackgroundClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-planner-select]")) {
      return;
    }

    props.selection.clearSelection();
  }

  function confirmDeletion(targetLabel: string, note?: string): boolean {
    const detail = note ? `${note}\n\n` : "";
    return window.confirm(
      `Delete ${targetLabel}?\n\n${detail}This action cannot be restored.`,
    );
  }

  return (
    <section
      className={`panel planner-panel mobile-sheet-${props.mobileSheetState} ${
        mobileSheetDrag.dragHeight !== null ? "mobile-sheet-dragging" : ""
      } ${props.isExpanded ? "expanded" : ""}`}
      style={
        mobileSheetDrag.dragHeight === null
          ? undefined
          : ({
              "--mobile-sheet-drag-height": `${mobileSheetDrag.dragHeight}px`,
            } as CSSProperties)
      }
    >
      <div className="mobile-sheet-handle-rail">
        <button
          type="button"
          className="mobile-sheet-handle"
          aria-label={`Resize itinerary panel, currently ${props.mobileSheetState}`}
          title="Resize itinerary panel"
          onPointerDown={mobileSheetDrag.handlePointerDown}
          onPointerMove={mobileSheetDrag.handlePointerMove}
          onPointerUp={mobileSheetDrag.handlePointerUp}
          onPointerCancel={mobileSheetDrag.handlePointerCancel}
          onClick={mobileSheetDrag.handleClick}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div
        className="mobile-sheet-content"
        onClick={clearSelectionOnBackgroundClick}
      >
        <header className="app-header">
          <div className="app-header-top-row">
            <Link
              className="app-header-dashboard-link"
              href={props.isGuest ? "/" : "/trips"}
            >
              <ChevronLeftIcon />
              <span>{props.isGuest ? "Home" : "Trips"}</span>
            </Link>
            <div className="app-header-controls">
              <FeedbackButton
                className="icon-button app-header-feedback-button tooltip-anchor"
                ariaLabel="Send feedback"
              >
                <ChatIcon />
                <span className="tooltip tooltip-bottom" aria-hidden="true">
                  Feedback
                </span>
              </FeedbackButton>
              <PlanWithAiButton
                className="ai-plan-button"
                onPlanWithAi={props.onPlanWithAi}
                mutedHint={props.aiPlanMutedHint}
              />
              <button
                type="button"
                className="panel-expand-toggle"
                aria-label={viewToggleDescription}
                title={viewToggleDescription}
                onClick={props.onToggleExpanded}
              >
                {props.isExpanded && (
                  <span className="panel-expand-toggle-icon" aria-hidden="true">
                    <ChevronLeftIcon />
                    <ChevronLeftIcon />
                  </span>
                )}
                <span>{viewToggleLabel}</span>
                {!props.isExpanded && (
                  <span className="panel-expand-toggle-icon" aria-hidden="true">
                    <ChevronRightIcon />
                    <ChevronRightIcon />
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="app-header-title-row">
            <div className="app-header-title-stack">
              <div className="app-header-name-row">
                <h1>{props.title}</h1>
                {props.onEditTrip && (
                  <button
                    type="button"
                    className="icon-button app-header-edit-trip-button"
                    aria-label="Edit trip details"
                    title="Edit trip details"
                    onClick={props.onEditTrip}
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
              {(props.tripPeriodLabel ||
                props.members.length > 1 ||
                props.onManageMembers) && (
                <div className="app-header-period-row">
                  {props.tripPeriodLabel && (
                    <p className="app-header-period">{props.tripPeriodLabel}</p>
                  )}
                  <TripMemberBadges
                    members={props.members}
                    currentUserId={props.currentUserId}
                    size="sm"
                    maxVisible={3}
                  />
                  {props.onManageMembers && (
                    <button
                      type="button"
                      className="icon-button app-header-members-button"
                      aria-label="Invite trip members"
                      title="Invite trip members"
                      onClick={props.onManageMembers}
                    >
                      <UserPlusIcon />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {props.error && <p className="error-text">{props.error}</p>}

        <div className="planner-scroll">
          <ItinerarySection
            itinerary={props.itinerary}
            activePlaceId={props.selection.activeItemId}
            activeCanonicalPlaceId={props.selection.activeCanonicalPlaceId}
            activeSegmentId={props.selection.activeSegmentId}
            activeDate={props.selection.activeDate}
            collapsedDates={props.collapsedDates}
            routeGeometries={props.routeGeometries}
            markerLabels={markerLabels}
            canEdit={props.canEdit}
            canAddVisits={props.canAddVisits}
            deletingPlaceIds={props.mutations.deletingPlaceIds}
            deletingItineraryItemIds={props.mutations.deletingItineraryItemIds}
            isExpanded={props.isExpanded}
            isUnscheduledOpen={isUnscheduledOpen}
            showRouteSegments={showRouteSegments}
            dropTargetKey={dropTargetKey}
            exportFeedback={props.exportFeedback}
            onDropTargetChange={setDropTargetKey}
            onToggleUnscheduledOpen={() =>
              setIsUnscheduledOpen((value) => !value)
            }
            onToggleRouteSegments={() =>
              setShowRouteSegments((value) => !value)
            }
            onCopyExport={props.onCopyExport}
            onDownloadExport={props.onDownloadExport}
            onToggleDatePlacePicker={toggleDatePlacePicker}
            onSelectPlace={props.selection.selectItem}
            onSelectCanonicalPlace={props.selection.selectCanonicalPlace}
            onSelectSegment={props.selection.toggleSegmentSelection}
            onToggleDateCollapsed={props.onToggleDateCollapsed}
            onSelectDate={props.selection.selectDate}
            onAddVisit={props.modals.openAddVisitModal}
            onEdit={props.modals.openEditModal}
            onDuplicateItem={props.modals.openDuplicateItemModal}
            onEditItem={props.modals.openEditItemModal}
            onDelete={props.mutations.deletePlace}
            onDeleteItem={props.mutations.deleteItineraryItem}
            onDeleteAllItems={props.mutations.deleteAllItineraryItems}
            onScheduleItem={props.mutations.scheduleItineraryItem}
            onModeChange={props.mutations.updateSegmentMode}
            onConfirmDeletion={confirmDeletion}
          />
        </div>

        <PlacesSection
          places={props.places}
          itinerary={props.itinerary}
          activePlaceId={props.selection.activeItemId}
          activeCanonicalPlaceId={props.selection.activeCanonicalPlaceId}
          canEdit={props.canEdit}
          canAddVisits={props.canAddVisits}
          deletingPlaceIds={props.mutations.deletingPlaceIds}
          isExpanded={props.isExpanded}
          isOpen={isPlacesOpen}
          onToggleOpen={() => setIsPlacesOpen((value) => !value)}
          onAddPlace={() => props.modals.openAddModal()}
          onSelectPlace={props.selection.selectItem}
          onSelectCanonicalPlace={props.selection.selectCanonicalPlace}
          onSelectSegment={props.selection.toggleSegmentSelection}
          onAddVisit={props.modals.openAddVisitModal}
          onEdit={props.modals.openEditModal}
          onDelete={props.mutations.deletePlace}
          onDeleteAll={props.mutations.deleteAllPlaces}
          onConfirmDeletion={confirmDeletion}
        />

        {picker &&
          props.canEdit &&
          typeof document !== "undefined" &&
          createPortal(
            <DatePlacePicker
              date={picker.date}
              places={props.places}
              style={{ left: picker.left, top: picker.top }}
              onClose={() => setPicker(null)}
              onCreatePlace={() => {
                props.modals.openAddModal(picker.date);
                setPicker(null);
              }}
              onSelect={(place) => {
                void props.mutations.schedulePlace(place.id, picker.date, null);
                setPicker(null);
              }}
            />,
            document.body,
          )}
      </div>
      {props.resizeHandle}
    </section>
  );
}
