import { findOwnedParticipant } from "@/features/challenges/data/participant.repository";

export class ParticipantAccessError extends Error {
   readonly code: "NOT_ENROLLED";

   constructor(message = "You are not enrolled in this challenge.") {
      super(message);
      this.name = "ParticipantAccessError";
      this.code = "NOT_ENROLLED";
   }
}

export async function requireOwnedParticipant(
   userId: string,
   challengeId: string
) {
   const participant = await findOwnedParticipant(userId, challengeId);

   if (!participant) {
      throw new ParticipantAccessError();
   }

   return participant;
}
