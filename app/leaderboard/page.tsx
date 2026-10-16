import { auth } from "@/core/auth";
import { cookies } from "next/headers";
import { AppHeader } from "@/features/auth/presentation/auth-nav";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";
import { TrophyLeaderboardView } from "@/features/trophies/presentation/trophy-leaderboard-view";

export const dynamic = "force-dynamic";

export const metadata = {
   title: "Trophy Leaderboard — HoldMeToIt",
   description:
      "Competitive ranking and trophy standings for the HoldMeToIt community.",
};

interface LeaderboardPageProps {
   searchParams?: {
      as?: string;
      page?: string;
   };
}

export default async function LeaderboardPage({
   searchParams,
}: LeaderboardPageProps) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: searchParams?.as,
   });

   const pageNum = parseInt(searchParams?.page || "1", 10) || 1;
   const { entries, pagination } = await getTrophyLeaderboard({
      page: pageNum,
      limit: 50,
   });

   return (
      <div className="min-h-screen bg-obsidian-bg text-obsidian-text">
         <AppHeader
            user={session?.user}
            isActualAdmin={isActualAdmin}
            isPreviewActive={isPreviewActive}
            subtitle="Competitive Standings"
         />
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-8">
            <TrophyLeaderboardView
               initialEntries={entries}
               initialPagination={pagination}
               currentUserId={session?.user?.id ?? null}
            />
         </main>
      </div>
   );
}
