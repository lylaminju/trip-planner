// Shared failure path for Supabase query errors. Kept out of supabase.ts so
// tests that mock the client module never have to re-declare this helper.
export function throwSupabaseError(error: { message: string }): never {
  throw new Error(`Supabase query failed: ${error.message}`);
}
