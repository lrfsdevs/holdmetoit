"use server";

import { signIn, signOut } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";

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
