import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TripsDashboard } from "@/components/TripsDashboard";
import { DEFAULT_PROFILE_COLOR } from "@/lib/profile-colors";
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
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null;

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  const profileColor =
    typeof user.user_metadata?.profile_color === "string"
      ? user.user_metadata.profile_color
      : DEFAULT_PROFILE_COLOR;

  return (
    <TripsDashboard
      userId={user.id}
      userName={userName}
      userEmail={user.email}
      profileColor={profileColor}
      isAdmin={isAdmin}
    />
  );
}
