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

  return <TripsDashboard />;
}
