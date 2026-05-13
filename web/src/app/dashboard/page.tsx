import { DashboardClient } from "@/components/DashboardClient";
import { getUserWatchlistAssets } from "@/lib/assets";
import { getCurrentUserProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect("/login");
  }

  const watchlistAssets = await getUserWatchlistAssets(userProfile.id);

  return (
    <DashboardClient
      userProfile={userProfile}
      watchlistAssets={watchlistAssets}
    />
  );
}
