import { DashboardClient } from "@/components/DashboardClient";
import { getWatchlistAssets } from "@/lib/assets";
import { authOptions } from "@/lib/auth-options";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const localSession = verifySessionToken(
    cookieStore.get(sessionCookieName)?.value
  );
  const authSession = await getServerSession(authOptions);
  const sessionEmail = localSession?.email ?? authSession?.user?.email;

  if (!sessionEmail) {
    redirect("/login");
  }

  const userName = sessionEmail.split("@")[0] || sessionEmail;
  const userInitial = sessionEmail.slice(0, 1).toUpperCase();
  const watchlistAssets = await getWatchlistAssets();

  return (
    <DashboardClient
      userEmail={sessionEmail}
      userInitial={userInitial}
      userName={userName}
      watchlistAssets={watchlistAssets}
    />
  );
}
