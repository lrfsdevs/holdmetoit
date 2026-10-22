"use client";

import { useEffect } from "react";

import {
   identifyLogRocketUser,
   initLogRocket,
} from "@/core/observability/logrocket";
import {
   isLogRocketEnabled,
   setLogRocketEnabled,
} from "@/core/observability/logrocket-config";

export type LogRocketSessionUser = {
   id?: string | null;
   name?: string | null;
   displayName?: string | null;
   role?: string | null;
   discordId?: string | null;
} | null;

export function LogRocketProvider({
   user,
   enabled,
}: {
   user?: LogRocketSessionUser;
   enabled: boolean;
}) {
   // Apply the feature flag before children render so client event handlers and
   // logger forwarding see the correct value immediately after hydration.
   setLogRocketEnabled(enabled);

   // LogRocket 12 has no public shutdown API. Turning the flag off prevents
   // initialization in newly loaded tabs; an already-initialized session keeps
   // recording until the tab reloads.
   useEffect(() => {
      if (!enabled || !isLogRocketEnabled()) {
         return;
      }

      initLogRocket();

      if (!user?.id) {
         return;
      }

      identifyLogRocketUser(user.id, {
         name: user.displayName || user.name || null,
         role: user.role ?? null,
         discordId: user.discordId ?? null,
      });
   }, [
      enabled,
      user?.id,
      user?.name,
      user?.displayName,
      user?.role,
      user?.discordId,
   ]);

   return null;
}
