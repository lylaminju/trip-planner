import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SignInPage } from "@/components/SignInPage";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

export default async function Page() {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (user) {
    redirect("/trips");
  }

  return <SignInPage />;
}
