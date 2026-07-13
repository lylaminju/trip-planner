import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/AdminDashboard";
import {
  getAuthenticatedUser,
  readAuthTokensFromCookieStore,
} from "@/server/auth-session";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const { user } = await getAuthenticatedUser(
    readAuthTokensFromCookieStore(cookieStore),
  );

  if (!user) redirect("/");

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) redirect("/trips");

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <a href="/trips" className="admin-page-back">
          ← Trips
        </a>
        <h1>Usage Dashboard</h1>
      </header>
      <div className="admin-page-content">
        <AdminDashboard />
      </div>
    </main>
  );
}
