import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ProfilePage } from "@/components/ProfilePage";
import { DEFAULT_PROFILE_COLOR } from "@/lib/profile-colors";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

export default async function ProfileRoute() {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (!user) {
    redirect("/");
  }

  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "";

  const profileColor =
    typeof user.user_metadata?.profile_color === "string"
      ? user.user_metadata.profile_color
      : DEFAULT_PROFILE_COLOR;

  const isAdmin =
    !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  return (
    <ProfilePage
      initialUsername={username}
      initialProfileColor={profileColor}
      userEmail={user.email}
      isAdmin={isAdmin}
    />
  );
}
