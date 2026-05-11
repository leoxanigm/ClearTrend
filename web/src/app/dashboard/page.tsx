import { DashboardClient } from "@/components/DashboardClient";
import { getWatchlistAssets } from "@/lib/assets";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );

  if (!session) {
    redirect("/login");
  }

  const userName = session.email.split("@")[0] || session.email;
  const userInitial = session.email.slice(0, 1).toUpperCase();
  const watchlistAssets = await getWatchlistAssets();

  return (
    <DashboardClient
      userEmail={session.email}
      userInitial={userInitial}
      userName={userName}
      watchlistAssets={watchlistAssets}
    />
  );
}
