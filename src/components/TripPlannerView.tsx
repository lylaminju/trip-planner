"use client";

import type { SubmitEvent } from "react";

import type { CurrentLocationPosition } from "@/lib/current-location";
import type { DestinationFocus } from "@/lib/destination-options";
import { errorMessage } from "@/lib/error-message";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type { ResolvedPlace } from "@/lib/planner-api";
import type {
  AiPlanningGenerationInput,
  AiPlanningSetup,
  ItineraryItem,
  ItineraryView,
  Place,
  PlannerSnapshot,
  RouteGeometry,
  TravelMode,
  TripMemberSummary,
  VisitDateOption,
} from "@/lib/types";

import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { AiPlanningWizard } from "./AiPlanningWizard";
import { EditItineraryItemModal } from "./EditItineraryItemModal";
import { EditTripModal } from "./EditTripModal";
import { MapPanel } from "./MapPanel";
import { PlannerPanel } from "./PlannerPanel";
import type { TripFormState } from "./trip-form-types";

type ExportFeedback = {
  action: "copy" | "download";
  kind: "error" | "success";
  label: string;
} | null;

type AiPlanningWizardState = {
  isOpen: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  setup: AiPlanningSetup | null;
  error: string | null;
};

type Props = {
  mobileSheetState: MobileSheetState;
  isPlannerPanelExpanded: boolean;
  tripTitle: string;
  tripPeriodLabel: string | null;
  members: TripMemberSummary[];
  currentUserId: string;
  destinationFocus: DestinationFocus | null;
  itinerary: ItineraryView;
  plannerSnapshot: PlannerSnapshot;
  activeItemId: number | null;
  activeCanonicalPlaceId: number | null;
  activeSegmentId: number | null;
  activeDate: string | null;
  collapsedDates: ReadonlySet<string>;
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
  error: string | null;
  aiGenerationToast: string | null;
  exportFeedback: ExportFeedback;
  canEdit: boolean;
  canEditTripMetadata: boolean;
  canAddVisits: boolean;
  deletingPlaceIds: ReadonlySet<number>;
  deletingItineraryItemIds: ReadonlySet<number>;
  currentLocationPosition: CurrentLocationPosition | null;
  currentLocationToast: string | null;
  canShowCurrentLocation: boolean;
  isCurrentLocationEnabled: boolean;
  isAdding: boolean;
  editingPlace: Place | null;
  editingItem: ItineraryItem | null;
  addingVisitPlace: Place | null;
  addPlaceVisitDate: string | null;
  editingTripForm: TripFormState | null;
  editTripError: string | null;
  isSavingTrip: boolean;
  aiPlanningWizard: AiPlanningWizardState;
  visitDateOptions: VisitDateOption[];
  onTogglePlannerExpanded: () => void;
  onPlanWithAi?: () => void;
  onMobileSheetStateChange: (state: MobileSheetState) => void;
  onOpenAddModal: (visitDate?: string | null) => void;
  onOpenEditTripModal: () => void;
  onManageMembers?: () => void;
  onCopyMarkdownExport: () => void;
  onDownloadMarkdownExport: () => void;
  onOpenAddVisitModal: (place: Place) => void;
  onOpenEditModal: (place: Place) => void;
  onOpenEditItemModal: (item: ItineraryItem) => void;
  onDeletePlace: (id: number) => Promise<void>;
  onDeleteAllPlaces: () => Promise<void>;
  onSelectItem: (id: number | null) => void;
  onSelectCanonicalPlace: (id: number | null) => void;
  onToggleSegmentSelection: (id: number | null) => void;
  onToggleDateCollapsed: (date: string) => void;
  onSelectDate: (date: string) => void;
  onClearSelection: () => void;
  onSchedulePlace: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => Promise<void>;
  onScheduleItineraryItem: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => Promise<void>;
  onDeleteItineraryItem: (id: number) => Promise<void>;
  onDeleteAllItineraryItems: () => Promise<void>;
  onUpdateSegmentMode: (id: number, mode: TravelMode) => Promise<void>;
  onToggleCurrentLocation: () => void;
  onCloseModal: () => void;
  onResolvePlaceUrl: (googleMapsUrl: string) => Promise<ResolvedPlace>;
  onSavePlace: (payload: Record<string, unknown>, id?: number) => Promise<void>;
  onSaveItineraryItem: (
    payload: Record<string, unknown>,
    id: number,
  ) => Promise<void>;
  onCreateItineraryItem: (
    placeId: number,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onSetEditingTripForm: (form: TripFormState | null) => void;
  onSubmitEditTrip: (event: SubmitEvent<HTMLFormElement>) => void;
  onSetError: (message: string | null) => void;
  onCloseAiPlanningWizard: () => void;
  onCreateAiItinerary: (input: AiPlanningGenerationInput) => Promise<void>;
  onRetryAiPlanningLoad: () => void;
};

export function TripPlannerView(props: Props) {
  const addingVisitPlace = props.addingVisitPlace;
  const editingItem = props.editingItem;

  return (
    <main
      className={`app-shell mobile-sheet-${props.mobileSheetState} ${
        props.isPlannerPanelExpanded ? "planner-panel-expanded" : ""
      }`}
    >
      <PlannerPanel
        title={props.tripTitle}
        tripPeriodLabel={props.tripPeriodLabel}
        members={props.members}
        currentUserId={props.currentUserId}
        itinerary={props.itinerary}
        places={props.plannerSnapshot.places}
        activePlaceId={props.activeItemId}
        activeCanonicalPlaceId={props.activeCanonicalPlaceId}
        activeSegmentId={props.activeSegmentId}
        activeDate={props.activeDate}
        collapsedDates={props.collapsedDates}
        routeGeometries={props.routeGeometries}
        error={props.error}
        exportFeedback={props.exportFeedback}
        isExpanded={props.isPlannerPanelExpanded}
        mobileSheetState={props.mobileSheetState}
        canEdit={props.canEdit}
        canAddVisits={props.canAddVisits}
        deletingPlaceIds={props.deletingPlaceIds}
        deletingItineraryItemIds={props.deletingItineraryItemIds}
        onToggleExpanded={props.onTogglePlannerExpanded}
        onPlanWithAi={props.onPlanWithAi}
        onMobileSheetStateChange={props.onMobileSheetStateChange}
        onAdd={props.onOpenAddModal}
        onEditTrip={
          props.canEditTripMetadata ? props.onOpenEditTripModal : undefined
        }
        onManageMembers={props.onManageMembers}
        onCopyExport={props.onCopyMarkdownExport}
        onDownloadExport={props.onDownloadMarkdownExport}
        onAddVisit={props.onOpenAddVisitModal}
        onEdit={props.onOpenEditModal}
        onEditItem={props.onOpenEditItemModal}
        onDelete={(id) =>
          props.onDeletePlace(id).catch((reason) => {
            props.onSetError(errorMessage(reason, "Failed to delete place."));
          })
        }
        onDeleteAllPlaces={() =>
          props.onDeleteAllPlaces().catch((reason) => {
            props.onSetError(errorMessage(reason, "Failed to delete places."));
          })
        }
        onSelectPlace={props.onSelectItem}
        onSelectCanonicalPlace={props.onSelectCanonicalPlace}
        onSelectSegment={props.onToggleSegmentSelection}
        onToggleDateCollapsed={props.onToggleDateCollapsed}
        onSelectDate={props.onSelectDate}
        onClearSelection={props.onClearSelection}
        onSchedulePlace={(id, date, time) =>
          props.onSchedulePlace(id, date, time).catch((reason) => {
            props.onSetError(errorMessage(reason, "Failed to schedule place."));
          })
        }
        onScheduleItem={(id, date, time) =>
          props.onScheduleItineraryItem(id, date, time).catch((reason) => {
            props.onSetError(
              errorMessage(reason, "Failed to schedule itinerary item."),
            );
          })
        }
        onDeleteItem={(id) =>
          props.onDeleteItineraryItem(id).catch((reason) => {
            props.onSetError(
              errorMessage(reason, "Failed to delete itinerary item."),
            );
          })
        }
        onDeleteAllItems={() =>
          props.onDeleteAllItineraryItems().catch((reason) => {
            props.onSetError(
              errorMessage(reason, "Failed to delete itinerary items."),
            );
          })
        }
        onModeChange={(id, mode) =>
          props.onUpdateSegmentMode(id, mode).catch((reason) => {
            props.onSetError(
              errorMessage(reason, "Failed to update route mode."),
            );
          })
        }
      />
      <MapPanel
        itinerary={props.itinerary}
        destinationFocus={props.destinationFocus}
        routeSegments={props.plannerSnapshot.routeSegments}
        activePlaceId={props.activeItemId}
        activeCanonicalPlaceId={props.activeCanonicalPlaceId}
        activeSegmentId={props.activeSegmentId}
        activeDate={props.activeDate}
        mobileSheetState={props.mobileSheetState}
        routeGeometries={props.routeGeometries}
        routeGeometryError={props.routeGeometryError}
        currentLocationPosition={props.currentLocationPosition}
        currentLocationToast={props.currentLocationToast}
        canShowCurrentLocation={props.canShowCurrentLocation}
        isCurrentLocationActive={props.isCurrentLocationEnabled}
        hidden={props.isPlannerPanelExpanded}
        canEdit={props.canEdit}
        onToggleCurrentLocation={props.onToggleCurrentLocation}
        onAddPlace={props.onOpenAddModal}
        onPlanWithAi={props.onPlanWithAi}
        onSelectPlace={props.onSelectItem}
        onSelectSegment={props.onToggleSegmentSelection}
        onEditItem={props.onOpenEditItemModal}
        onEditPlace={props.onOpenEditModal}
        onClearSelection={props.onClearSelection}
      />
      {props.aiGenerationToast && (
        <div className="ai-generation-toast" role="status">
          {props.aiGenerationToast}
        </div>
      )}
      {(props.isAdding || props.editingPlace) && (
        <AddEditPlaceModal
          place={props.editingPlace}
          visitDateOptions={props.visitDateOptions}
          defaultVisitDate={props.editingPlace ? null : props.addPlaceVisitDate}
          destinationBias={
            props.destinationFocus
              ? {
                  latitude: props.destinationFocus.latitude,
                  longitude: props.destinationFocus.longitude,
                }
              : null
          }
          onCancel={props.onCloseModal}
          onResolveUrl={props.onResolvePlaceUrl}
          onSave={(payload) =>
            props.onSavePlace(payload, props.editingPlace?.id)
          }
        />
      )}
      {editingItem && (
        <EditItineraryItemModal
          item={editingItem}
          visitDateOptions={props.visitDateOptions}
          onCancel={props.onCloseModal}
          onSave={(payload) =>
            props.onSaveItineraryItem(payload, editingItem.id)
          }
        />
      )}
      {addingVisitPlace && (
        <EditItineraryItemModal
          place={addingVisitPlace}
          visitDateOptions={props.visitDateOptions}
          onCancel={props.onCloseModal}
          onSave={(payload) =>
            props.onCreateItineraryItem(addingVisitPlace.id, payload)
          }
        />
      )}
      {props.editingTripForm && (
        <EditTripModal
          form={props.editingTripForm}
          error={props.editTripError}
          isSaving={props.isSavingTrip}
          onChange={props.onSetEditingTripForm}
          onCancel={() => props.onSetEditingTripForm(null)}
          onSubmit={props.onSubmitEditTrip}
        />
      )}
      {props.aiPlanningWizard.isOpen && (
        <AiPlanningWizard
          setup={props.aiPlanningWizard.setup}
          isLoading={props.aiPlanningWizard.isLoading}
          error={props.aiPlanningWizard.error}
          isGenerating={props.aiPlanningWizard.isGenerating}
          onCancel={props.onCloseAiPlanningWizard}
          onCreateItinerary={props.onCreateAiItinerary}
          onRetryLoad={props.onRetryAiPlanningLoad}
        />
      )}
    </main>
  );
}
