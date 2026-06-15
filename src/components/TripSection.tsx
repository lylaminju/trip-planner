import type { SubmitEvent } from "react";

import type { TripSummary } from "@/lib/types";
import { FoldedMapIcon } from "./Icons";
import { TripEditForm } from "./TripEditForm";
import { TripRow } from "./TripRow";
import type { TripFormState } from "./trip-form-types";

export function TripSection(props: {
  title: string;
  trips: TripSummary[];
  featuredTripId?: number;
  editing: { tripId: number; form: TripFormState } | null;
  isSaving: boolean;
  deletingTripIds: Set<number>;
  onEditStart: (trip: TripSummary) => void;
  onEditCancel: () => void;
  onEditChange: (form: TripFormState) => void;
  onEditSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onDelete: (trip: TripSummary) => void;
}) {
  const tripCountLabel =
    props.trips.length === 1 ? "1 trip" : `${props.trips.length} trips`;

  return (
    <section className="trip-section">
      <div className="trip-section-heading">
        <h2>{props.title}</h2>
        <span>{tripCountLabel}</span>
      </div>
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
    </section>
  );
}
