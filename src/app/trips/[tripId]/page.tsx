import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { TripPlannerApp } from "@/components/TripPlannerApp";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";
import { TripAccessDeniedError } from "@/server/errors";
import {
  guestSessionSecret,
  readGuestIdFromCookieStore,
} from "@/server/guest-session";
import { getTripPlannerInitialDataForRequest } from "@/server/place-service";
import { guestPrincipalId } from "@/server/principal";

type Props = {
  params: Promise<{ tripId: string }>;
};

export default async function TripPlannerPage({ params }: Props) {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  // A signed guest cookie opens exactly the guest's own ephemeral trips; trip
  // access checks reject everything else below.
  const principalId = user?.id ?? readGuestPrincipalId(cookieStore);
  if (!principalId) {
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
      principalId,
    );

    return (
      <TripPlannerApp
        tripId={parsedTripId}
        currentUserId={principalId}
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

function readGuestPrincipalId(cookieStore: {
  get(name: string): { value: string } | undefined;
}): string | null {
  const secret = guestSessionSecret();
  const guestId = secret
    ? readGuestIdFromCookieStore(cookieStore, secret)
    : null;
  return guestId ? guestPrincipalId(guestId) : null;
}
