import Link from "next/link";

import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { auth } from "@/core/auth";
import { getManualLeaderboardData } from "@/features/leaderboard/data/manual-leaderboard.repository";
import { ManualLeaderboardView } from "@/features/leaderboard/presentation/manual-leaderboard-view";
import { logError, logEvents } from "@/core/observability/logger";

interface ManualLeaderboardPageProps {
   params: {
      id: string;
   };
}

export default async function ManualLeaderboardPage({
   params,
}: ManualLeaderboardPageProps) {
   try {
      const [session, data] = await Promise.all([
         auth(),
         getManualLeaderboardData(params.id),
      ]);

      if (!data) {
         return (
            <EmptyState
               title="Challenge not found"
               description="We couldn't locate this weekly manual challenge in our records."
               action={
                  <Button asChild variant="secondary" className="min-h-[44px]">
                     <Link href="/">Return to Study Lounge</Link>
                  </Button>
               }
            />
         );
      }

      return (
         <ManualLeaderboardView data={data} currentUserId={session?.user?.id} />
      );
   } catch (error) {
      logError(logEvents.appError, {
         scope: "challenge.manual.page",
         context: { challengeId: params.id },
         error,
      });
      return (
         <ErrorState
            title="Could not load manual leaderboard"
            message="Something went wrong while fetching the leaderboard from the database."
         />
      );
   }
}
