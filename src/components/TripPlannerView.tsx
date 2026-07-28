"use client";

import type { CSSProperties, SubmitEvent } from "react";

import { usePlannerPanelResize } from "@/hooks/usePlannerPanelResize";
import type { CurrentLocationControl } from "@/hooks/useCurrentLocationControl";
import type { TripPlannerModals } from "@/hooks/useTripPlannerModals";
import type { TripPlannerMutations } from "@/hooks/useTripPlannerMutations";
import type { TripPlannerSelection } from "@/hooks/useTripPlannerSelection";
import type { DestinationFocus } from "@/lib/destination-options";
import type { MobileSheetState } from "@/lib/mobile-sheet";
import type {
  AiCatalogPrepStatus,
  AiPlanningGenerationInput,
  AiPlanningSetup,
  ItineraryView,
  PlannerSnapshot,
  RouteGeometry,
  TripMemberSummary,
  VisitDateOption,
} from "@/lib/types";

import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { AiPlanningWizard } from "./AiPlanningWizard";
import { EditItineraryItemModal } from "./EditItineraryItemModal";
import { EditTripModal } from "./EditTripModal";
import { GuestModeBanner } from "./GuestModeBanner";
import { MapPanel } from "./MapPanel";
import { PlannerPanel } from "./PlannerPanel";
import { PlannerResizeHandle } from "./planner-panel/PlannerResizeHandle";

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
  catalogStatus: AiCatalogPrepStatus;
  hubsStatus: AiCatalogPrepStatus;
};

export type TripPlannerPermissions = {
  canEdit: boolean;
  canEditTripMetadata: boolean;
  canAddVisits: boolean;
};

type Props = {
  tripId: number;
  isGuest: boolean;
  mobileSheetState: MobileSheetState;
  isPlannerPanelExpanded: boolean;
  tripTitle: string;
  tripPeriodLabel: string | null;
  members: TripMemberSummary[];
  currentUserId: string;
  destinationFocus: DestinationFocus | null;
  destinationCountryCodes: string[] | null;
  itinerary: ItineraryView;
  plannerSnapshot: PlannerSnapshot;
  collapsedDates: ReadonlySet<string>;
  routeGeometries: Map<number, RouteGeometry>;
  routeGeometryError: string | null;
  error: string | null;
  aiGenerationToast: string | null;
  exportFeedback: ExportFeedback;
  permissions: TripPlannerPermissions;
  selection: TripPlannerSelection;
  mutations: TripPlannerMutations;
  modals: TripPlannerModals;
  currentLocation: CurrentLocationControl;
  canShowCurrentLocation: boolean;
  editTripError: string | null;
  isSavingTrip: boolean;
  aiPlanningWizard: AiPlanningWizardState;
  visitDateOptions: VisitDateOption[];
  onTogglePlannerExpanded: () => void;
  onPlanWithAi?: () => void;
  aiPlanNeedsDates?: boolean;
  onMobileSheetStateChange: (state: MobileSheetState) => void;
  onManageMembers?: () => void;
  onCopyMarkdownExport: () => void;
  onDownloadMarkdownExport: () => void;
  onToggleDateCollapsed: (date: string) => void;
  onSubmitEditTrip: (event: SubmitEvent<HTMLFormElement>) => void;
  onCloseAiPlanningWizard: () => void;
  onRetryAiCatalogPrepare: () => void;
  onCreateAiItinerary: (input: AiPlanningGenerationInput) => Promise<void>;
  onRetryAiPlanningLoad: () => void;
};

export function TripPlannerView(props: Props) {
  const { modals, mutations, selection, permissions } = props;
  const { addingVisitPlace, editingItem, duplicatingItem } = modals;
  const panelResize = usePlannerPanelResize();

  return (
    <main
      className={`app-shell mobile-sheet-${props.mobileSheetState} ${
        props.isPlannerPanelExpanded ? "planner-panel-expanded" : ""
      } ${panelResize.isResizing ? "planner-resizing" : ""}`}
      style={
        {
          "--planner-panel-width": `${panelResize.width}px`,
        } as CSSProperties
      }
    >
      <PlannerPanel
        title={props.tripTitle}
        tripPeriodLabel={props.tripPeriodLabel}
        members={props.members}
        currentUserId={props.currentUserId}
        itinerary={props.itinerary}
        places={props.plannerSnapshot.places}
        selection={selection}
        mutations={mutations}
        modals={modals}
        collapsedDates={props.collapsedDates}
        routeGeometries={props.routeGeometries}
        error={props.error}
        exportFeedback={props.exportFeedback}
        isExpanded={props.isPlannerPanelExpanded}
        isGuest={props.isGuest}
        mobileSheetState={props.mobileSheetState}
        canEdit={permissions.canEdit}
        canAddVisits={permissions.canAddVisits}
        onToggleExpanded={props.onTogglePlannerExpanded}
        onPlanWithAi={props.onPlanWithAi}
        aiPlanNeedsDates={props.aiPlanNeedsDates}
        onMobileSheetStateChange={props.onMobileSheetStateChange}
        onEditTrip={
          permissions.canEditTripMetadata ? modals.openEditTripModal : undefined
        }
        onManageMembers={props.onManageMembers}
        onCopyExport={props.onCopyMarkdownExport}
        onDownloadExport={props.onDownloadMarkdownExport}
        onToggleDateCollapsed={props.onToggleDateCollapsed}
        resizeHandle={
          <PlannerResizeHandle handleProps={panelResize.handleProps} />
        }
      />
      <MapPanel
        itinerary={props.itinerary}
        destinationFocus={props.destinationFocus}
        routeSegments={props.plannerSnapshot.routeSegments}
        selection={selection}
        modals={modals}
        mobileSheetState={props.mobileSheetState}
        routeGeometries={props.routeGeometries}
        routeGeometryError={props.routeGeometryError}
        currentLocation={props.currentLocation}
        canShowCurrentLocation={props.canShowCurrentLocation}
        hidden={props.isPlannerPanelExpanded}
        canEdit={permissions.canEdit}
        onPlanWithAi={props.onPlanWithAi}
        aiPlanNeedsDates={props.aiPlanNeedsDates}
      />
      {props.aiGenerationToast && (
        <div className="ai-generation-toast" role="status">
          {props.aiGenerationToast}
        </div>
      )}
      {props.isGuest && <GuestModeBanner />}
      {(modals.isAdding || modals.editingPlace) && (
        <AddEditPlaceModal
          tripId={props.tripId}
          isGuest={props.isGuest}
          place={modals.editingPlace}
          savedPlaces={props.plannerSnapshot.places}
          visitDateOptions={props.visitDateOptions}
          defaultVisitDate={
            modals.editingPlace ? null : modals.addPlaceVisitDate
          }
          initialSearchPlace={
            modals.editingPlace ? null : modals.addPlaceSelection
          }
          destinationBias={
            props.destinationFocus
              ? {
                  latitude: props.destinationFocus.latitude,
                  longitude: props.destinationFocus.longitude,
                }
              : null
          }
          destinationCountryCodes={props.destinationCountryCodes}
          onCancel={modals.closeModal}
          onResolveUrl={mutations.resolvePlace}
          onSave={(payload) =>
            mutations.savePlace(payload, modals.editingPlace?.id)
          }
        />
      )}
      {editingItem && (
        <EditItineraryItemModal
          item={editingItem}
          visitDateOptions={props.visitDateOptions}
          onCancel={modals.closeModal}
          onSave={(payload) =>
            mutations.saveItineraryItem(payload, editingItem.id)
          }
        />
      )}
      {addingVisitPlace && (
        <EditItineraryItemModal
          place={addingVisitPlace}
          visitDateOptions={props.visitDateOptions}
          onCancel={modals.closeModal}
          onSave={(payload) =>
            mutations.createItineraryItem(addingVisitPlace.id, payload)
          }
        />
      )}
      {duplicatingItem && (
        <EditItineraryItemModal
          item={duplicatingItem}
          mode="duplicate"
          visitDateOptions={props.visitDateOptions}
          onCancel={modals.closeModal}
          onSave={(payload) =>
            mutations.createItineraryItem(duplicatingItem.place_id, payload)
          }
        />
      )}
      {modals.editingTripForm && (
        <EditTripModal
          form={modals.editingTripForm}
          isGuest={props.isGuest}
          error={props.editTripError}
          isSaving={props.isSavingTrip}
          onChange={modals.setEditingTripForm}
          onCancel={() => modals.setEditingTripForm(null)}
          onSubmit={props.onSubmitEditTrip}
        />
      )}
      {props.aiPlanningWizard.isOpen && (
        <AiPlanningWizard
          setup={props.aiPlanningWizard.setup}
          isLoading={props.aiPlanningWizard.isLoading}
          catalogStatus={props.aiPlanningWizard.catalogStatus}
          hubsStatus={props.aiPlanningWizard.hubsStatus}
          onRetryCatalogPrepare={props.onRetryAiCatalogPrepare}
          error={props.aiPlanningWizard.error}
          isGenerating={props.aiPlanningWizard.isGenerating}
          isGuest={props.isGuest}
          onCancel={props.onCloseAiPlanningWizard}
          onCreateItinerary={props.onCreateAiItinerary}
          onRetryLoad={props.onRetryAiPlanningLoad}
        />
      )}
    </main>
  );
}
