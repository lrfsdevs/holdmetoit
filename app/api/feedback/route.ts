import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/auth";
import {
   createFeedbackRecord,
   updateFeedbackDiscordStatus,
} from "@/features/feedback/data/feedback.repository";
import { sendFeedbackToDiscord } from "@/features/feedback/data/discord-feedback.service";
import { formatFeedbackCode } from "@/features/feedback/domain/feedback-code";
import { createFeedbackSchema } from "@/features/feedback/domain/feedback.schema";
import { createLogger, logEvents } from "@/core/observability/logger";

const logger = createLogger("feedback");

export async function POST(req: NextRequest) {
   try {
      const json = await req.json();
      const parsed = createFeedbackSchema.safeParse(json);

      if (!parsed.success) {
         const errorMessage =
            parsed.error.issues[0]?.message ?? "Invalid feedback submission";
         return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
         );
      }

      const session = await auth();
      const userId = session?.user?.id ?? null;

      // Persist to PostgreSQL first (Source of Truth)
      const feedback = await createFeedbackRecord({
         type: parsed.data.type,
         title: parsed.data.title,
         description: parsed.data.description,
         url: parsed.data.url,
         logrocketSessionId: parsed.data.logrocketSessionId ?? null,
         userId,
      });

      const code = formatFeedbackCode(feedback.feedbackNumber);

      // Build reporter identity for Discord notification
      const reporter = session?.user
         ? {
              username: session.user.name ?? null,
              displayName:
                 session.user.displayName ?? session.user.name ?? null,
              discordId: session.user.discordId ?? null,
           }
         : null;

      // Asynchronously dispatch to Discord with safe fallback
      const discordResult = await sendFeedbackToDiscord({
         feedbackNumber: feedback.feedbackNumber,
         type: parsed.data.type,
         title: feedback.title,
         description: feedback.description,
         url: feedback.url,
         logrocketSessionId: feedback.logrocketSessionId,
         reporter,
         createdAt: feedback.createdAt,
      });

      if (discordResult.success && discordResult.messageId) {
         await updateFeedbackDiscordStatus(feedback.id, {
            status: "SENT",
            discordMessageId: discordResult.messageId,
            discordChannelId: discordResult.channelId,
         });
      } else {
         await updateFeedbackDiscordStatus(feedback.id, {
            status: "FAILED",
            discordChannelId: discordResult.channelId ?? null,
         });
         logger.warn(logEvents.feedbackDiscordDispatchFailed, {
            context: {
               code,
               feedbackId: feedback.id,
               discordError: discordResult.error,
            },
         });
      }

      logger.info(logEvents.feedbackSubmitted, {
         context: {
            code,
            feedbackId: feedback.id,
            type: parsed.data.type,
            userId,
            discordDelivered: discordResult.success,
         },
      });

      return NextResponse.json(
         {
            success: true,
            data: {
               id: feedback.id,
               feedbackNumber: feedback.feedbackNumber,
               code,
               type: parsed.data.type,
               status: feedback.status,
               discordDelivered: discordResult.success,
            },
         },
         { status: 201 }
      );
   } catch (error) {
      const message =
         error instanceof Error ? error.message : "Internal server error";
      logger.error(logEvents.feedbackSubmitted, { error });
      return NextResponse.json(
         { success: false, error: message },
         { status: 500 }
      );
   }
}
