export type ProfileUpdate = {
  username: string;
  profileColor: string;
};

export async function updateProfile(
  payload: ProfileUpdate,
): Promise<ProfileUpdate> {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "Failed to save profile.",
    );
  }

  return data.profile as ProfileUpdate;
}
