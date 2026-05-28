import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

type Props = {
  params: Promise<{ tripId: string }>;
};

export default async function TripPlannerPage({ params }: Props) {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (!user) {
    redirect("/login");
  }

  const { tripId } = await params;
  const parsedTripId = Number(tripId);
  if (!Number.isInteger(parsedTripId)) {
    notFound();
  }

  return <TripPlannerApp tripId={parsedTripId} />;
}
