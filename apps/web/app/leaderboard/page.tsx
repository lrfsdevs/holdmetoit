import { auth } from "@/core/auth";
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";
import { TrophyLeaderboardView } from "@/features/trophies/presentation/trophy-leaderboard-view";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { EmptyState } from "@/components/state/empty-state";
import { findActiveChallengeEnrollment } from "@/features/challenges/data/participant.repository";

export const dynamic = "force-dynamic";

export const metadata = {
   title: "Trophy Leaderboard — HoldMeToIt",
   description:
      "Competitive ranking and trophy standings for the HoldMeToIt community.",
};

export default async function LeaderboardPage() {
   const leaderboardEnabled = await isFeatureEnabled(
      FEATURE_FLAG_KEYS.globalLeaderboard
   );

   if (!leaderboardEnabled) {
      return (
         <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
            <main className="mx-auto max-w-5xl px-3 sm:px-6 py-8">
               <EmptyState
                  title="Global leaderboard is currently unavailable"
                  description="Trophy rankings are temporarily locked. Please check back later."
               />
            </main>
         </div>
      );
   }

   const session = await auth();
   const currentUserId = session?.user?.id ?? null;

   const [{ entries }, activeEnrollment] = await Promise.all([
      getTrophyLeaderboard({ all: true }),
      currentUserId
         ? findActiveChallengeEnrollment(currentUserId)
         : Promise.resolve(null),
   ]);

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-8">
            <TrophyLeaderboardView
               initialEntries={entries}
               currentUserId={currentUserId}
               hasActiveChallenge={Boolean(activeEnrollment)}
            />
         </main>
      </div>
   );
}
