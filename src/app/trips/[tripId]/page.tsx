import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";
import { TripAccessDeniedError } from "@/server/errors";
import { getPlannerSnapshotForRequest } from "@/server/place-service";

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

  try {
    const initialSnapshot = await getPlannerSnapshotForRequest(
      parsedTripId,
      user.id,
    );

    return (
      <TripPlannerApp
        tripId={parsedTripId}
        initialSnapshot={initialSnapshot}
      />
    );
  } catch (error) {
    if (error instanceof TripAccessDeniedError) {
      notFound();
    }

    throw error;
  }
}
