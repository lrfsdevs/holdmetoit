"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import { PARTICIPANT_PREVIEW_COOKIE } from "@/features/auth/domain/preview-mode";

const logger = createLogger("auth.preview");

export async function toggleParticipantPreviewAction(desiredState?: boolean) {
   const session = await auth();
   if (!session?.user || !hasAdminPrivileges(session.user.role)) {
      logger.debug(logEvents.authPreviewToggled, {
         context: { allowed: false, userId: session?.user?.id },
      });
      return { ok: false, isPreviewActive: false };
   }

   const cookieStore = cookies();
   const currentState =
      cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value === "true";
   const nextState = desiredState !== undefined ? desiredState : !currentState;

   if (nextState) {
      cookieStore.set(PARTICIPANT_PREVIEW_COOKIE, "true", {
         path: "/",
         maxAge: 60 * 60 * 24 * 7, // 7 days
         sameSite: "lax",
      });
   } else {
      cookieStore.delete(PARTICIPANT_PREVIEW_COOKIE);
   }

   logger.info(logEvents.authPreviewToggled, {
      context: { isPreviewActive: nextState, userId: session.user.id },
   });

   revalidatePath("/", "layout");
   return { ok: true, isPreviewActive: nextState };
}
