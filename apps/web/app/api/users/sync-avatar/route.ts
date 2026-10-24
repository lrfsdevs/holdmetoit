import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";
import { getClientIp } from "@/core/security/client-ip";
import { checkRateLimit } from "@/core/security/rate-limiter";
import { syncUserAvatar } from "@/features/auth/data/discord-avatar.service";

const logger = createLogger("api-sync-avatar");

const requestSchema = z.object({
   userId: z.string().min(1).optional(),
   discordId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
   try {
      const session = await auth();
      if (!session?.user?.id) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const clientIp = getClientIp(req.headers);
      const rateLimitKey = `sync-avatar:${session.user.id}:${clientIp}`;
      const rateLimit = checkRateLimit(rateLimitKey, {
         maxAttempts: 10,
         windowMs: 60 * 1000,
      });

      if (!rateLimit.allowed) {
         const retryAfter = Math.ceil(rateLimit.resetMs / 1000);
         return NextResponse.json(
            { error: "Too many requests. Please wait a moment." },
            {
               status: 429,
               headers: { "Retry-After": String(retryAfter) },
            }
         );
      }

      const body = await req.json().catch(() => ({}));
      const parsed = requestSchema.safeParse(body);

      if (!parsed.success) {
         return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
            { status: 400 }
         );
      }

      const targetUserId =
         parsed.data.userId ||
         (!parsed.data.discordId ? session.user.id : undefined);
      const allowOAuth = Boolean(
         targetUserId && targetUserId === session.user.id
      );

      const result = await syncUserAvatar({
         userId: targetUserId,
         discordId: parsed.data.discordId,
         allowOAuth,
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
