import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";
import { TripAccessDeniedError } from "@/server/errors";
import { getTripPlannerInitialDataForRequest } from "@/server/place-service";

type Props = {
  params: Promise<{ tripId: string }>;
};

export default async function TripPlannerPage({ params }: Props) {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (!user) {
    redirect("/");
  }

  const { tripId } = await params;
  const parsedTripId = Number(tripId);
  if (!Number.isInteger(parsedTripId)) {
    notFound();
  }

  try {
    const initialData = await getTripPlannerInitialDataForRequest(
      parsedTripId,
      user.id,
    );

    return (
      <TripPlannerApp
        tripId={parsedTripId}
        currentUserId={user.id}
        initialData={initialData}
      />
    );
  } catch (error) {
    if (error instanceof TripAccessDeniedError) {
      notFound();
    }

    throw error;
  }
}
