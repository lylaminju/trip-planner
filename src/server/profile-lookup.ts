import { getSupabaseClient } from "@/server/supabase";

export type ProfileLookupResult = {
  found: boolean;
  username: string | null;
};

// Exact-match only: takes a full email and returns at most one profile. This is
// intentionally not a search endpoint, so it cannot be used to enumerate users
// by prefix or list results.
export async function lookupProfileByEmail(
  email: string,
): Promise<ProfileLookupResult> {
  const { data, error } = await getSupabaseClient()
    .from("profiles")
    .select("username")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!data) {
    return { found: false, username: null };
  }

  return { found: true, username: (data as { username: string | null }).username };
}
