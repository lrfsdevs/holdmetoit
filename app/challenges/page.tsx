import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { listAllChallenges } from "@/features/challenges/data/challenge.repository";
import { ChallengesListView } from "@/features/challenges/presentation/challenges-list-view";

export const dynamic = "force-dynamic";

/** Loads the public challenges directory and admin visibility state. */
export default async function ChallengesDirectoryPage() {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
   });

   let challenges: Awaited<ReturnType<typeof listAllChallenges>> = [];
   try {
      challenges = await listAllChallenges();
   } catch {
      challenges = [];
   }

   return (
      <ChallengesListView
         challenges={challenges}
         canManageChallenges={isAdmin}
      />
   );
}
