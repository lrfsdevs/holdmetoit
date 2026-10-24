import { NextResponse } from "next/server";
import { z } from "zod";

import { createLogger, logEvents } from "@/core/observability/logger";
import { syncUserAvatar } from "@/features/auth/data/discord-avatar.service";

const logger = createLogger("api-sync-avatar");

const requestSchema = z
   .object({
      userId: z.string().min(1).optional(),
      discordId: z.string().min(1).optional(),
   })
   .refine((data) => data.userId || data.discordId, {
      message: "Either userId or discordId must be provided",
   });

export async function POST(req: Request) {
   try {
      const body = await req.json().catch(() => ({}));
      const parsed = requestSchema.safeParse(body);

      if (!parsed.success) {
         return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
            { status: 400 }
         );
      }

      const result = await syncUserAvatar({
         userId: parsed.data.userId,
         discordId: parsed.data.discordId,
      });

      return NextResponse.json(result, { status: 200 });
   } catch (error) {
      logger.error(logEvents.appError, {
         context: { route: "/api/users/sync-avatar" },
         error,
      });
      return NextResponse.json(
         { error: "Internal server error" },
         { status: 500 }
      );
   }
}
