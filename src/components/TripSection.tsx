import type { SubmitEvent } from "react";

import type { TripSummary } from "@/lib/types";
import { CollapseToggleButton } from "./CollapseToggleButton";
import { FoldedMapIcon } from "./Icons";
import { TripEditForm } from "./TripEditForm";
import { TripRow } from "./TripRow";
import type { TripFormState } from "./trip-form-types";

export function TripSection(props: {
  sectionId?: string;
  title: string;
  trips: TripSummary[];
  featuredTripId?: number;
  isOpen?: boolean;
  editing: { tripId: number; form: TripFormState } | null;
  isSaving: boolean;
  deletingTripIds: Set<number>;
  onEditStart: (trip: TripSummary) => void;
  onEditCancel: () => void;
  onEditChange: (form: TripFormState) => void;
  onEditSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onDelete: (trip: TripSummary) => void;
  onToggleOpen?: () => void;
}) {
  const tripCountLabel =
    props.trips.length === 1 ? "1 trip" : `${props.trips.length} trips`;
  const isOpen = props.isOpen ?? true;
  const sectionId = props.sectionId ?? tripSectionId(props.title);
  const sectionPanelId = `${sectionId}-panel`;

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
        <span>{tripCountLabel}</span>
      </div>
      <div id={sectionPanelId} hidden={!isOpen}>
        {props.trips.length === 0 ? (
          <div className="trip-list">
            <div
              className="trip-empty-bucket"
              aria-label="No trips in this section."
            >
              <FoldedMapIcon />
            </div>
          </div>
        ) : (
          <div className="trip-list">
            {props.trips.map((trip) =>
              props.editing?.tripId === trip.id ? (
                <TripEditForm
                  key={trip.id}
                  trip={trip}
                  form={props.editing.form}
                  isFeatured={trip.id === props.featuredTripId}
                  isSaving={props.isSaving}
                  onChange={props.onEditChange}
                  onCancel={props.onEditCancel}
                  onSubmit={props.onEditSubmit}
                />
              ) : (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  isFeatured={trip.id === props.featuredTripId}
                  isDeleting={props.deletingTripIds.has(trip.id)}
                  onEdit={() => props.onEditStart(trip)}
                  onDelete={() => props.onDelete(trip)}
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
