/**
 * Checks if two users have an accepted mutual friendship.
 * Stubbed cleanly to prepare for full integration with the Friend Request system (#145).
 */
export async function checkAreAcceptedFriends(
   userId1?: string | null,
   userId2?: string | null
): Promise<boolean> {
   if (!userId1 || !userId2 || userId1 === userId2) {
      return false;
   }

   // Note: When GitHub Issue #145 / Friendship schema is merged,
   // this will query:
   // return prisma.friendship.count({
   //    where: {
   //       OR: [
   //          { senderId: userId1, receiverId: userId2, status: "ACCEPTED" },
   //          { senderId: userId2, receiverId: userId1, status: "ACCEPTED" },
   //       ],
   //    },
   // }) > 0;

   return false;
}
