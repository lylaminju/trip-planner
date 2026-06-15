import Link from "next/link";

import { getTripCoverImage } from "@/lib/city-covers";
import { isTripOngoing } from "@/lib/trip-classification";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import type { TripSummary } from "@/lib/types";
import { DeleteLoadingSpinner } from "./DeleteLoadingSpinner";
import { MapPinIcon, PencilIcon, TrashIcon } from "./Icons";

export function TripRow(props: {
  trip: TripSummary;
  isFeatured?: boolean;
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
  const periodLabel = formatTripPeriodLabel(props.trip);
  const destinationLabel =
    props.trip.destination?.trim() || "Destination needed";
  const coverImage = getTripCoverImage({
    destination: props.trip.destination,
  });
  const durationLabel = formatTripDurationLabel(props.trip);
  const isOngoing = isTripOngoing(props.trip);

  return (
    <article
      className={props.isFeatured ? "trip-row featured-trip" : "trip-row"}
    >
      <Link className="trip-row-main" href={`/trips/${props.trip.id}`}>
        <span
          className="trip-cover"
          aria-hidden="true"
          style={{ backgroundImage: `url("${coverImage}")` }}
        />
        <strong>{props.trip.name}</strong>
        <span className="trip-destination">
          <span className="trip-destination-icon">
            <MapPinIcon />
          </span>
          <span className="trip-destination-text">{destinationLabel}</span>
        </span>
        <span
          className="trip-period"
          aria-label={periodLabel ? undefined : "Dates not set"}
        >
          {periodLabel ?? "-"}
        </span>
      </Link>
      <div className="trip-card-meta">
        {durationLabel && (
          <span className="trip-duration">{durationLabel}</span>
        )}
        {isOngoing && <span className="trip-duration">Ongoing</span>}
        <span className={`trip-role trip-role-${props.trip.role}`}>
          {props.trip.role}
        </span>
      </div>
      <div className="trip-row-meta">
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
      </div>
    </article>
  );
}

function formatTripDurationLabel(trip: TripSummary): string | null {
  if (!trip.start_date || !trip.end_date) return "Needs dates";

  const start = new Date(`${trip.start_date}T00:00:00Z`).getTime();
  const end = new Date(`${trip.end_date}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  const days = Math.round((end - start) / 86_400_000) + 1;
  return days === 1 ? "1 day" : `${days} days`;
}
