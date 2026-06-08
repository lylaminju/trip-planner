import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginPage } from "@/components/LoginPage";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (user) {
    redirect("/trips");
  }

  return <LoginPage />;
}
