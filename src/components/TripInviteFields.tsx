"use client";

import type { TripRole } from "@/lib/types";

export const DEFAULT_INVITE_ROLE: TripRole = "viewer";

export const ROLE_OPTIONS: { value: TripRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "owner", label: "Owner" },
];

export type TripInviteDraft = {
  email: string;
  role: TripRole;
};

export function emptyTripInvite(): TripInviteDraft {
  return { email: "", role: DEFAULT_INVITE_ROLE };
}

type Props = {
  email: string;
  role: TripRole;
  emailLabel: string;
  emailRequired: boolean;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: TripRole) => void;
};

export function TripInviteFields(props: Props) {
  return (
    <>
      <label className="trip-create-field trip-members-invite-email">
        <span className="trip-create-field-label">{props.emailLabel}</span>
        <input
          autoComplete="off"
          name="email"
          type="email"
          placeholder="friend@example.com"
          required={props.emailRequired}
          value={props.email}
          onChange={(event) => props.onEmailChange(event.currentTarget.value)}
        />
      </label>
      <div
        aria-labelledby="trip-members-role-label"
        className="trip-create-field trip-members-invite-role"
        role="radiogroup"
      >
        <span
          className="trip-create-field-label"
          id="trip-members-role-label"
        >
          Role
        </span>
        <div className="trip-members-role-options">
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className="trip-members-role-option">
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={props.role === option.value}
                onChange={() => props.onRoleChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
