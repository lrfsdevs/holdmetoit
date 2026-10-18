import { redirect } from "next/navigation";
import { auth } from "@/core/auth";
import { prisma } from "@/core/db";
import { findParticipantForUser } from "@/features/challenges/data/participant.repository";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
   searchParams?: {
      challengeId?: string;
   };
}

/** Resolves the current user's profile route to an enrolled participant page or fallback profile. */
export default async function ProfilePage({ searchParams }: ProfilePageProps) {
   const session = await auth();

   if (!session?.user?.id) {
      redirect("/");
      return;
   }

   // 1. If challengeId is explicitly provided in query, find participant for that challenge first
   if (searchParams?.challengeId) {
      const participant = await findParticipantForUser(
         session.user.id,
         searchParams.challengeId
      );
      if (participant) {
         redirect(
            `/challenge/${participant.challengeId}/participant/${participant.id}`
         );
         return;
      }

      // If user is not enrolled in this challenge, redirect to their fallback profile in this challenge
      const targetChallenge = await prisma.challenge.findUnique({
         where: { id: searchParams.challengeId, isDeleted: false },
         select: { id: true },
      });
      if (targetChallenge) {
         redirect(
            `/challenge/${targetChallenge.id}/participant/${session.user.id}`
         );
         return;
      }
   }

   // 2. Otherwise find the user's active, upcoming, or most recent challenge participant record
   const participant = await findParticipantForUser(session.user.id);
   if (participant) {
      redirect(
         `/challenge/${participant.challengeId}/participant/${participant.id}`
      );
      return;
   }

   // 3. Fallback for users with no challenge participation (e.g. registered after last event ended):
   // Resolve to the latest challenge so they can see their profile and status in context.
   const latestChallenge = await prisma.challenge.findFirst({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: { id: true },
   });

   if (latestChallenge) {
      redirect(
         `/challenge/${latestChallenge.id}/participant/${session.user.id}`
      );
      return;
   }

   // 4. If no challenges exist in database at all, redirect to challenges catalog
   redirect("/challenges");
}
