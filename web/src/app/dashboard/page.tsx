import { DashboardClient } from "@/components/DashboardClient";
import { getWatchlistAssets } from "@/lib/assets";
import { getCurrentUserProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect("/login");
  }

  const watchlistAssets = await getWatchlistAssets();

  return (
    <DashboardClient
      userProfile={userProfile}
      watchlistAssets={watchlistAssets}
    />
  );
}
