import { prisma } from "@/core/db";

export async function isFeedbackAttachmentReferenced(
   path: string
): Promise<boolean> {
   const count = await prisma.feedbackAttachment.count({ where: { path } });
   return count > 0;
}
