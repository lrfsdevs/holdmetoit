"use client";

import { useEffect } from "react";

import {
   identifyLogRocketUser,
   initLogRocket,
} from "@/core/observability/logrocket";
import { isLogRocketEnabled } from "@/core/observability/logrocket-config";

export type LogRocketSessionUser = {
   id?: string | null;
   name?: string | null;
   displayName?: string | null;
   role?: string | null;
   discordId?: string | null;
} | null;

export function LogRocketProvider({ user }: { user?: LogRocketSessionUser }) {
   useEffect(() => {
      if (!isLogRocketEnabled()) {
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
   }, [user?.id, user?.name, user?.displayName, user?.role, user?.discordId]);

   return null;
}
