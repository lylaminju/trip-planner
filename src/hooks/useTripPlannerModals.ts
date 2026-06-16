import { useState } from "react";

import type { ItineraryItem, Place, Trip } from "@/lib/types";
import type { TripFormState } from "@/components/trip-form-types";
import { formFromTrip } from "@/components/trip-planner-app-utils";

type TripPlannerModals = {
  addPlaceVisitDate: string | null;
  addingVisitPlace: Place | null;
  editingItem: ItineraryItem | null;
  editingPlace: Place | null;
  editingTripForm: TripFormState | null;
  isAdding: boolean;
  closeModal: () => void;
  openAddModal: (visitDate?: string | null) => void;
  openAddVisitModal: (place: Place) => void;
  openEditItemModal: (item: ItineraryItem) => void;
  openEditModal: (place: Place) => void;
  openEditTripModal: () => void;
  setAddingVisitPlace: (place: Place | null) => void;
  setEditingItem: (item: ItineraryItem | null) => void;
  setEditingTripForm: (form: TripFormState | null) => void;
};

export function useTripPlannerModals(input: {
  canEdit: boolean;
  canEditTripMetadata: boolean;
  trip: Trip | null;
  clearError: () => void;
}): TripPlannerModals {
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [editingTripForm, setEditingTripForm] = useState<TripFormState | null>(
    null,
  );
  const [addingVisitPlace, setAddingVisitPlace] = useState<Place | null>(null);
  const [addPlaceVisitDate, setAddPlaceVisitDate] = useState<string | null>(
    null,
  );
  const [isAdding, setIsAdding] = useState(false);

  function openAddModal(visitDate: string | null = null) {
    if (!input.canEdit) return;
    input.clearError();
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setAddPlaceVisitDate(visitDate);
    setIsAdding(true);
  }

  function openEditModal(place: Place) {
    if (!input.canEdit) return;
    input.clearError();
    setEditingPlace(place);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setAddPlaceVisitDate(null);
    setIsAdding(true);
  }

  function openEditItemModal(item: ItineraryItem) {
    if (!input.canEdit) return;
    input.clearError();
    setEditingPlace(null);
    setEditingItem(item);
    setAddingVisitPlace(null);
    setAddPlaceVisitDate(null);
    setIsAdding(false);
  }

  function openAddVisitModal(place: Place) {
    if (!input.canEdit) return;
    input.clearError();
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(place);
    setAddPlaceVisitDate(null);
    setIsAdding(false);
  }

  function openEditTripModal() {
    if (!input.canEditTripMetadata || !input.trip) return;
    input.clearError();
    setEditingTripForm(formFromTrip(input.trip));
  }

  function closeModal() {
    setIsAdding(false);
    setEditingPlace(null);
    setEditingItem(null);
    setAddingVisitPlace(null);
    setAddPlaceVisitDate(null);
  }

  return {
    addPlaceVisitDate,
    addingVisitPlace,
    editingItem,
    editingPlace,
    editingTripForm,
    isAdding,
    closeModal,
    openAddModal,
    openAddVisitModal,
    openEditItemModal,
    openEditModal,
    openEditTripModal,
    setAddingVisitPlace,
    setEditingItem,
    setEditingTripForm,
  };
}
