"use client";

import { useState, type SubmitEvent } from "react";

import { countryLabelForDestination } from "@/lib/destination-options";
import { errorMessage } from "@/lib/error-message";
import { DEFAULT_PROFILE_COLOR } from "@/lib/profile-colors";
import { addTripMember, removeTripMember } from "@/lib/trip-members-api";
import type { TripMemberSummary, TripRole } from "@/lib/types";

import { DeleteLoadingSpinner } from "./DeleteLoadingSpinner";
import { CloseIcon, TrashIcon } from "./Icons";
import { ModalShell } from "./ModalShell";
import { memberDisplayName } from "./TripMemberBadges";
import { DEFAULT_INVITE_ROLE, TripInviteFields } from "./TripInviteFields";

const INVITE_FORM_ID = "trip-members-invite-form";

type Props = {
  tripId: number;
  tripName: string;
  destination: string;
  destinationSlug: string | null;
  members: TripMemberSummary[];
  currentUserId: string;
  onClose: () => void;
  onMembersChange: (members: TripMemberSummary[]) => void;
};

export function TripMembersModal(props: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TripRole>(DEFAULT_INVITE_ROLE);
  const [isInviting, setIsInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const countryLabel = countryLabelForDestination(props.destinationSlug);
  const destinationLabel = [props.destination.trim() || null, countryLabel]
    .filter(Boolean)
    .join(", ");

  async function submitInvite(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInviting(true);
    setError(null);
    try {
      props.onMembersChange(
        await addTripMember(props.tripId, email.trim(), role),
      );
      setEmail("");
      setRole(DEFAULT_INVITE_ROLE);
    } catch (reason) {
      setError(errorMessage(reason, "Failed to invite member."));
    } finally {
      setIsInviting(false);
    }
  }

  async function removeMember(member: TripMemberSummary) {
    setRemovingUserId(member.user_id);
    setError(null);
    try {
      props.onMembersChange(
        await removeTripMember(props.tripId, member.user_id),
      );
    } catch (reason) {
      setError(errorMessage(reason, "Failed to remove member."));
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <ModalShell className="trip-create-modal-backdrop" onClose={props.onClose}>
      <div
        aria-labelledby="trip-members-title"
        aria-modal="true"
        className="modal trip-create-modal trip-members-modal"
        role="dialog"
      >
        <header className="trip-members-header">
          <div className="trip-members-header-meta">
            <h2 id="trip-members-title">{props.tripName}</h2>
            {destinationLabel && (
              <p className="trip-members-header-destination">
                {destinationLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={props.onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="trip-create-body trip-members-body">
          {error && (
            <p className="error-text trip-create-error" role="alert">
              {error}
            </p>
          )}

          <section className="trip-create-field">
            <span className="trip-create-field-label">Travelers</span>
            <ul className="trip-members-list">
              {props.members.map((member) => (
                <li key={member.user_id} className="trip-members-row">
                  <span
                    className="trip-members-row-badge"
                    aria-hidden="true"
                    style={{
                      background: member.profile_color ?? DEFAULT_PROFILE_COLOR,
                    }}
                  >
                    {memberDisplayName(member).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="trip-members-row-name">
                    {memberDisplayName(member)}
                    {member.user_id === props.currentUserId && (
                      <span className="trip-members-row-you"> (you)</span>
                    )}
                  </span>
                  <span
                    className={
                      member.role === "owner"
                        ? "trip-members-role-chip trip-members-role-chip-owner"
                        : "trip-members-role-chip"
                    }
                  >
                    {member.role}
                  </span>
                  <span className="trip-members-row-action">
                    {member.user_id !== props.currentUserId && (
                      <button
                        type="button"
                        className="icon-button danger-button"
                        aria-label={`Remove ${memberDisplayName(member)} from trip`}
                        title={`Remove ${memberDisplayName(member)} from trip`}
                        disabled={removingUserId !== null}
                        onClick={() => removeMember(member)}
                      >
                        {removingUserId === member.user_id ? (
                          <DeleteLoadingSpinner />
                        ) : (
                          <TrashIcon />
                        )}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <form
            className="trip-members-invite-fields"
            id={INVITE_FORM_ID}
            onSubmit={submitInvite}
          >
            <TripInviteFields
              email={email}
              role={role}
              emailLabel="Invite by email"
              emailRequired
              onEmailChange={setEmail}
              onRoleChange={setRole}
            />
          </form>
        </div>

        <footer className="modal-actions trip-form-actions trip-create-footer">
          <button
            type="submit"
            form={INVITE_FORM_ID}
            className="trip-form-submit"
            disabled={isInviting}
          >
            {isInviting ? "Inviting..." : "Invite"}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}
