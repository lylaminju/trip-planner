import Link from "next/link";

import { getTripCoverImage } from "@/lib/city-covers";
import {
  countdownLabel,
  daysUntilStart,
  tripDayOf,
  tripDurationDays,
} from "@/lib/trip-day-metrics";
import { formatTripPeriodLabel } from "@/lib/trip-period-label";
import type { TripSummary } from "@/lib/types";
import { DeleteLoadingSpinner } from "./DeleteLoadingSpinner";
import { MapPinIcon, PencilIcon, TrashIcon, UserPlusIcon } from "./Icons";
import { TripMemberBadges } from "./TripMemberBadges";

export function FeaturedTripCard(props: {
  trip: TripSummary;
  isOngoing: boolean;
  currentUserId: string;
  canEdit: boolean;
  isDeleting?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onManageMembers?: () => void;
}) {
  const { trip } = props;
  const coverImage = getTripCoverImage({
    destination: trip.destination,
    destinationSlug: trip.destination_slug,
  });
  const destinationLabel = trip.destination?.trim() || "Destination needed";
  const totalDays = tripDurationDays(trip);
  const periodLabel = formatTripPeriodLabel(trip);
  const dayOf = props.isOngoing ? tripDayOf(trip) : null;
  const countdown = props.isOngoing ? null : daysUntilStart(trip);
  const durationLabel = totalDays
    ? `${totalDays} ${totalDays === 1 ? "day" : "days"}`
    : null;
  const dateLine = [periodLabel, durationLabel].filter(Boolean).join(" · ");
  const editLabel = `Edit trip ${trip.name}`;
  const membersLabel = `Invite members to trip ${trip.name}`;
  const deleteLabel = props.isDeleting
    ? `Deleting trip ${trip.name}`
    : `Delete trip ${trip.name}`;

  return (
    <article className="featured-trip-card">
      <div className="featured-trip-info">
        <div className="featured-trip-badges">
          {props.isOngoing ? (
            <>
              <span className="trip-badge trip-badge-accent">
                Happening now
              </span>
              {dayOf && totalDays && (
                <span className="trip-badge trip-badge-muted">
                  Day {dayOf} of {totalDays}
                </span>
              )}
            </>
          ) : countdown != null ? (
            <span className="trip-badge trip-badge-accent">
              {countdownLabel(countdown)}
            </span>
          ) : (
            <span className="trip-badge trip-badge-muted">Up next</span>
          )}
        </div>

        <div className="featured-trip-name-row">
          <h2 className="featured-trip-name">{trip.name}</h2>
          <TripMemberBadges
            members={trip.members}
            currentUserId={props.currentUserId}
            size="lg"
            maxVisible={3}
          />
        </div>

        <div className="featured-trip-destination">
          <span className="trip-destination-icon" aria-hidden="true">
            <MapPinIcon />
          </span>
          <span className="trip-destination-text">{destinationLabel}</span>
        </div>

        {dateLine && <div className="featured-trip-dates">{dateLine}</div>}

        <div className="featured-trip-actions">
          <Link className="featured-trip-open" href={`/trips/${trip.id}`}>
            Open planner →
          </Link>
          {props.canEdit && (
            <div className="featured-trip-icon-actions">
              {props.onManageMembers && (
                <button
                  type="button"
                  className="icon-button featured-trip-members"
                  aria-label={membersLabel}
                  title={membersLabel}
                  onClick={props.onManageMembers}
                >
                  <UserPlusIcon />
                </button>
              )}
              <button
                type="button"
                className="icon-button featured-trip-edit"
                aria-label={editLabel}
                title={editLabel}
                onClick={props.onEdit}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="icon-button danger-button featured-trip-delete"
                aria-label={deleteLabel}
                title={deleteLabel}
                disabled={props.isDeleting}
                onClick={props.onDelete}
              >
                {props.isDeleting ? <DeleteLoadingSpinner /> : <TrashIcon />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="featured-trip-cover"
        aria-hidden="true"
        style={{ backgroundImage: `url("${coverImage}")` }}
      />
    </article>
  );
}
