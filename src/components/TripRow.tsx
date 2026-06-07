import Link from "next/link";

import type { TripSummary } from "@/lib/types";
import { DeleteLoadingSpinner } from "./DeleteLoadingSpinner";
import { PencilIcon, TrashIcon } from "./Icons";

export function TripRow(props: {
  trip: TripSummary;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}) {
  const canEditMetadata = props.trip.role === "owner";
  const editLabel = `Edit trip ${props.trip.name}`;
  const deleteLabel = `Delete trip ${props.trip.name}`;
  const deleteButtonLabel = props.isDeleting
    ? `Deleting trip ${props.trip.name}`
    : deleteLabel;

  return (
    <article className="trip-row">
      <Link className="trip-row-main" href={`/trips/${props.trip.id}`}>
        <strong>{props.trip.name}</strong>
        <span>{formatTripDateLine(props.trip)}</span>
      </Link>
      <span className={`trip-role trip-role-${props.trip.role}`}>
        {props.trip.role}
      </span>
      {canEditMetadata && (
        <div className="trip-row-actions">
          <button
            type="button"
            className="icon-button"
            title={editLabel}
            aria-label={editLabel}
            onClick={props.onEdit}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="icon-button danger-button"
            title={deleteButtonLabel}
            aria-label={deleteButtonLabel}
            disabled={props.isDeleting}
            onClick={props.onDelete}
          >
            {props.isDeleting ? <DeleteLoadingSpinner /> : <TrashIcon />}
          </button>
        </div>
      )}
    </article>
  );
}

function formatTripDateLine(trip: TripSummary): string {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${trip.start_date} to ${trip.end_date}`
      : "Needs dates";

  return `${dateRange} (${trip.timezone})`;
}
