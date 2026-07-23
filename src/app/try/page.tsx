import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GuestTripForm } from "@/components/GuestTripForm";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";
import { guestSessionSecret } from "@/server/guest-session";

export default async function TryPage() {
  // cookies() runs first so the page stays dynamic: the guest-mode env check
  // must happen per request, not once at build time.
  const cookieStore = await cookies();

  // Signed-in members plan from their dashboard; the guest form is only for
  // anonymous visitors, and only while guest mode is configured.
  if (!guestSessionSecret()) {
    redirect("/");
  }

  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );
  if (user) {
    redirect("/trips");
  }

  return <GuestTripForm />;
}
