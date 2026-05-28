import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
    redirect("/login");
  }

  return (
    <main className="app-shell">
      <section className="left-panel">
        <div className="panel-section">
          <h1>Trips</h1>
          <p>Trip dashboard is not implemented yet.</p>
        </div>
      </section>
    </main>
  );
}
