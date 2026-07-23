// Guest principals travel through the same string parameters that carry
// authenticated user ids, marked by a prefix no Supabase auth UUID can have.
// Every user_id/created_by column is uuid-typed, so a guest principal that
// reaches a user-only query fails at the database instead of matching another
// user's data.
export const GUEST_PRINCIPAL_PREFIX = "guest:";

export function guestPrincipalId(guestId: string): string {
  return `${GUEST_PRINCIPAL_PREFIX}${guestId}`;
}

export function isGuestPrincipalId(principalId: string): boolean {
  return principalId.startsWith(GUEST_PRINCIPAL_PREFIX);
}

export function guestIdFromPrincipalId(principalId: string): string | null {
  return isGuestPrincipalId(principalId)
    ? principalId.slice(GUEST_PRINCIPAL_PREFIX.length)
    : null;
}
