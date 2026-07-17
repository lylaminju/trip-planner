import type { SubmitEvent } from "react";

import type { TripSummary } from "@/lib/types";
import { CollapseToggleButton } from "./CollapseToggleButton";
import { FoldedMapIcon } from "./Icons";
import { TripCard, type TripCardVariant } from "./TripCard";
import { TripEditForm } from "./TripEditForm";
import type { TripFormState } from "./trip-form-types";

export function TripSection(props: {
  sectionId?: string;
  title: string;
  variant: TripCardVariant;
  trips: TripSummary[];
  currentUserId: string;
  isOpen?: boolean;
  editing: { tripId: number; form: TripFormState } | null;
  isSaving: boolean;
  deletingTripIds: Set<number>;
  onEditStart: (trip: TripSummary) => void;
  onEditCancel: () => void;
  onEditChange: (form: TripFormState) => void;
  onEditSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onDelete: (trip: TripSummary) => void;
  onManageMembers?: (trip: TripSummary) => void;
  onToggleOpen?: () => void;
}) {
  const isOpen = props.isOpen ?? true;
  const sectionId = props.sectionId ?? tripSectionId(props.title);
  const sectionPanelId = `${sectionId}-panel`;
  const gridClassName = `trip-card-grid trip-card-grid-${props.variant}`;

  return (
    <section className="trip-section">
      <div className="trip-section-heading">
        <div className="trip-section-title-row">
          <CollapseToggleButton
            className="trip-section-collapse-button"
            controlsId={sectionPanelId}
            label={props.title}
            open={isOpen}
            onToggle={props.onToggleOpen ?? noop}
          />
          <h2>{props.title}</h2>
        </div>
        <span>{props.trips.length}</span>
      </div>
      <div id={sectionPanelId} hidden={!isOpen}>
        {props.trips.length === 0 ? (
          <div className={gridClassName}>
            <div
              className="trip-empty-bucket"
              aria-label="No trips in this section."
            >
              <FoldedMapIcon />
            </div>
          </div>
        ) : (
          <div className={gridClassName}>
            {props.trips.map((trip) =>
              props.editing?.tripId === trip.id ? (
                <TripEditForm
                  key={trip.id}
                  trip={trip}
                  form={props.editing.form}
                  isSaving={props.isSaving}
                  onChange={props.onEditChange}
                  onCancel={props.onEditCancel}
                  onSubmit={props.onEditSubmit}
                />
              ) : (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  variant={props.variant}
                  currentUserId={props.currentUserId}
                  canEdit={trip.role === "owner"}
                  isDeleting={props.deletingTripIds.has(trip.id)}
                  onEdit={() => props.onEditStart(trip)}
                  onDelete={() => props.onDelete(trip)}
                  onManageMembers={
                    props.onManageMembers
                      ? () => props.onManageMembers?.(trip)
                      : undefined
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function tripSectionId(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function noop() {}
