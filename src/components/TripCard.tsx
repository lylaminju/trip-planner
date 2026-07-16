import Link from "next/link";

import { getTripCoverImage } from "@/lib/city-covers";
import {
  countdownLabel,
  daysUntilStart,
  tripDurationDays,
} from "@/lib/trip-day-metrics";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import type { TripSummary } from "@/lib/types";
import { DeleteLoadingSpinner } from "./DeleteLoadingSpinner";
import { PencilIcon, TrashIcon } from "./Icons";
import { TripMemberBadges } from "./TripMemberBadges";

export type TripCardVariant = "upcoming" | "past";

export function TripCard(props: {
  trip: TripSummary;
  variant: TripCardVariant;
  currentUserId: string;
  canEdit: boolean;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { trip, variant } = props;
  const coverImage = getTripCoverImage({
    destination: trip.destination,
    destinationSlug: trip.destination_slug,
  });
  const destinationLabel = trip.destination?.trim() || "Destination needed";
  const periodLabel = formatTripPeriodLabel(trip);
  const hasDates = Boolean(trip.start_date && trip.end_date);
  const totalDays = tripDurationDays(trip);
  const durationLabel = totalDays
    ? `${totalDays} ${totalDays === 1 ? "day" : "days"}`
    : null;
  const dateLine = hasDates
    ? [periodLabel, durationLabel].filter(Boolean).join(" · ")
    : "No dates yet";
  const countdown = variant === "upcoming" ? daysUntilStart(trip) : null;
  const editLabel = `Edit trip ${trip.name}`;
  const deleteLabel = props.isDeleting
    ? `Deleting trip ${trip.name}`
    : `Delete trip ${trip.name}`;

  return (
    <article className={`trip-card trip-card-${variant}`}>
      <Link className="trip-card-main" href={`/trips/${trip.id}`}>
        <span
          className="trip-card-cover"
          aria-hidden="true"
          style={{ backgroundImage: `url("${coverImage}")` }}
        />
        <span className="trip-card-content">
          <span className="trip-card-name-row">
            <strong className="trip-card-name">{trip.name}</strong>
            <TripMemberBadges
              members={trip.members}
              currentUserId={props.currentUserId}
              size={variant === "past" ? "sm" : "md"}
              maxVisible={2}
            />
          </span>
          <span className="trip-card-destination">{destinationLabel}</span>
          <span className="trip-card-footer">
            <span className="trip-card-dates">{dateLine}</span>
            {variant === "upcoming" && hasDates && countdown != null && (
              <span className="trip-badge trip-badge-accent trip-card-countdown">
                {countdownLabel(countdown)}
              </span>
            )}
          </span>
        </span>
      </Link>

      {variant === "upcoming" && !hasDates && props.canEdit && (
        <button
          type="button"
          className="trip-card-add-dates"
          onClick={props.onEdit}
        >
          + Add dates
        </button>
      )}

      {props.canEdit && (
        <div className="trip-card-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={editLabel}
            title={editLabel}
            onClick={props.onEdit}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="icon-button danger-button"
            aria-label={deleteLabel}
            title={deleteLabel}
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
