import { redirect } from "next/navigation";
import { auth } from "@/core/auth";
import { findParticipantForUser } from "@/features/challenges/data/participant.repository";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
   searchParams?: {
      challengeId?: string;
   };
}

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
   }

   // 2. Otherwise find the user's active, upcoming, or most recent challenge participant record
   const participant = await findParticipantForUser(session.user.id);
   if (participant) {
      redirect(
         `/challenge/${participant.challengeId}/participant/${participant.id}`
      );
      return;
   }

   // 3. Fallback: if not enrolled in any challenge, redirect to challenges catalog
   redirect("/challenges");
}
