import { auth } from "@/core/auth";
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";
import { TrophyLeaderboardView } from "@/features/trophies/presentation/trophy-leaderboard-view";

export const dynamic = "force-dynamic";

export const metadata = {
   title: "Trophy Leaderboard — HoldMeToIt",
   description:
      "Competitive ranking and trophy standings for the HoldMeToIt community.",
};

export default async function LeaderboardPage() {
   const session = await auth();

   const { entries } = await getTrophyLeaderboard({ all: true });

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary">
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-8">
            <TrophyLeaderboardView
               initialEntries={entries}
               currentUserId={session?.user?.id ?? null}
            />
         </main>
      </div>
   );
}
