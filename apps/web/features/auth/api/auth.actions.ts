"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";
import { checkRateLimit } from "@/core/security/rate-limiter";
import {
   syncUserAvatar,
   type SyncUserAvatarResult,
} from "@/features/auth/data/discord-avatar.service";

const logger = createLogger("auth");

export async function loginWithDiscordAction(redirectTo?: string) {
   const redirect = redirectTo || "/";
   logger.info(logEvents.authDiscordSignin, { context: { redirect } });
   await signIn("discord", { redirectTo: redirect });
}

export async function logoutAction() {
   logger.info(logEvents.authSignout);
   await signOut({ redirectTo: "/" });
}

/**
 * Server action to refresh the currently authenticated user's Discord avatar.
 * Strictly binds refresh execution to session.user.id and enforces rate limits.
 */
export async function refreshUserAvatarAction(): Promise<SyncUserAvatarResult> {
   const session = await auth();
   if (!session?.user?.id) {
      return {
         success: false,
         newImageUrl: null,
         error: "Unauthorized",
      };
   }

   const rateLimit = checkRateLimit(`sync-avatar:${session.user.id}`, {
      maxAttempts: 5,
      windowMs: 60 * 1000,
   });

   if (!rateLimit.allowed) {
      const retryAfter = Math.ceil(rateLimit.resetMs / 1000);
      return {
         success: false,
         newImageUrl: null,
         error: `Too many refresh attempts. Please wait ${retryAfter}s.`,
      };
   }

   const result = await syncUserAvatar({
      userId: session.user.id,
      allowOAuth: true,
   });

   if (result.success && result.updated) {
      revalidatePath("/", "layout");
      revalidatePath("/profile", "layout");
   }

   return result;
}
