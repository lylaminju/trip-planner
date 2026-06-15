import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TripsDashboard } from "@/components/TripsDashboard";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

export default async function TripsPage() {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (!user) {
    redirect("/");
  }

  const userName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null;

  return <TripsDashboard userName={userName} userEmail={user.email} />;
}
