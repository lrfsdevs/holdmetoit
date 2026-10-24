"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";
import { syncUserAvatar } from "@/features/auth/data/discord-avatar.service";

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

export async function refreshUserAvatarAction() {
   const session = await auth();
   if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
   }

   const result = await syncUserAvatar({ userId: session.user.id });
   if (result.success && result.newImageUrl) {
      revalidatePath("/", "layout");
      return { success: true, image: result.newImageUrl };
   }

   return { success: false, error: "Failed to sync avatar from Discord" };
}
