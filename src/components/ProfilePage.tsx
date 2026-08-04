"use client";

import { useState, type SubmitEvent } from "react";

import { errorMessage } from "@/lib/error-message";
import { logoutRequest } from "@/lib/planner-api";
import { updateProfile } from "@/lib/profile-api";
import { PROFILE_COLORS } from "@/lib/profile-colors";
import { DietaryPreferenceFields } from "./DietaryPreferenceFields";
import { LogoutIcon } from "./Icons";
import { TripsDashboardRail } from "./TripsDashboardRail";

export function ProfilePage(props: {
  initialUsername: string;
  initialProfileColor: string;
  initialDietaryTags?: string[];
  initialDietaryNotes?: string | null;
  userEmail?: string;
  isAdmin?: boolean;
}) {
  const [username, setUsername] = useState(props.initialUsername);
  const [profileColor, setProfileColor] = useState(props.initialProfileColor);
  const [dietaryTags, setDietaryTags] = useState<string[]>(
    props.initialDietaryTags ?? [],
  );
  const [dietaryNotes, setDietaryNotes] = useState(
    props.initialDietaryNotes ?? "",
  );
  const [savedProfile, setSavedProfile] = useState({
    username: props.initialUsername,
    profileColor: props.initialProfileColor,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const trimmedName = username.trim();
  const displayName = trimmedName || "Traveler";
  const avatarInitial = displayName.slice(0, 1).toUpperCase();
  const railDisplayName = savedProfile.username.trim() || "Traveler";

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setIsSaved(false);

    try {
      const saved = await updateProfile({
        username: trimmedName,
        profileColor,
        dietaryTags,
        dietaryNotes: dietaryNotes.trim() === "" ? null : dietaryNotes.trim(),
      });
      setUsername(saved.username);
      setProfileColor(saved.profileColor);
      setDietaryTags(saved.dietaryTags);
      setDietaryNotes(saved.dietaryNotes ?? "");
      setSavedProfile({
        username: saved.username,
        profileColor: saved.profileColor,
      });
      setIsSaved(true);
    } catch (reason) {
      setError(errorMessage(reason, "Failed to save profile."));
    } finally {
      setIsSaving(false);
    }
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <main className="trips-page">
      <section className="trips-dashboard-shell">
        <TripsDashboardRail
          displayName={railDisplayName}
          userEmail={props.userEmail}
          profileColor={savedProfile.profileColor}
          isTripsActive={false}
          isAdmin={props.isAdmin}
        />

        <section className="trips-main-pane">
          <header className="trips-header">
            <h1>Edit profile</h1>
          </header>

          <div className="profile-settings">
            <div className="profile-preview">
              <span
                className="profile-preview-avatar"
                style={{ background: profileColor }}
                aria-hidden="true"
              >
                {avatarInitial}
              </span>
              <div className="profile-preview-copy">
                <strong>{displayName}</strong>
                {props.userEmail && <span>{props.userEmail}</span>}
              </div>
            </div>

            <form className="profile-form" onSubmit={submit}>
              <label className="profile-field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  maxLength={40}
                  placeholder="Your name"
                  suppressHydrationWarning
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setIsSaved(false);
                  }}
                />
              </label>

              <div className="profile-field">
                <span>Avatar color</span>
                <div
                  className="profile-swatch-grid"
                  role="radiogroup"
                  aria-label="Avatar color"
                >
                  {PROFILE_COLORS.map((color) => {
                    const isSelected = color.hex === profileColor;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        className={
                          isSelected
                            ? "profile-swatch profile-swatch-selected"
                            : "profile-swatch"
                        }
                        style={{ background: color.hex }}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={color.label}
                        title={color.label}
                        onClick={() => {
                          setProfileColor(color.hex);
                          setIsSaved(false);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="profile-field">
                <span>Food preferences &amp; restrictions</span>
                <DietaryPreferenceFields
                  tags={dietaryTags}
                  notes={dietaryNotes}
                  onTagsChange={(tags) => {
                    setDietaryTags(tags);
                    setIsSaved(false);
                  }}
                  onNotesChange={(notes) => {
                    setDietaryNotes(notes);
                    setIsSaved(false);
                  }}
                />
              </div>

              {error && <p className="error-text">{error}</p>}

              <div className="profile-actions">
                {isSaved && !error && (
                  <span className="profile-saved-note">Saved</span>
                )}
                <button
                  type="submit"
                  className="trip-create-trigger"
                  disabled={isSaving || !trimmedName}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>

            <div className="profile-logout">
              <button
                type="button"
                className="profile-logout-button"
                onClick={logout}
              >
                <LogoutIcon />
                Log out
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
