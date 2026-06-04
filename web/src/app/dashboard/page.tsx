import { DashboardClient } from "@/components/DashboardClient";
import { getUserWatchlistAssets } from "@/lib/assets";
import { getCurrentUserProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams?: Promise<{
    range?: string;
    symbol?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const userProfile = await getCurrentUserProfile();

  if (!userProfile) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const watchlistAssets = await getUserWatchlistAssets(userProfile.id);

  return (
    <DashboardClient
      initialRange={params.range ?? null}
      initialSymbol={params.symbol ?? null}
      userProfile={userProfile}
      watchlistAssets={watchlistAssets}
    />
  );
}
