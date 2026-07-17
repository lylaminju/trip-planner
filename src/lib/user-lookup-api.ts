export type UserLookupResult = {
  found: boolean;
  username: string | null;
};

export async function lookupUserByEmail(
  email: string,
  signal?: AbortSignal,
): Promise<UserLookupResult> {
  const response = await fetch(
    `/api/users/lookup?email=${encodeURIComponent(email)}`,
    { signal },
  );

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Failed to look up email.",
    );
  }

  return {
    found: Boolean(data.found),
    username: typeof data.username === "string" ? data.username : null,
  };
}
