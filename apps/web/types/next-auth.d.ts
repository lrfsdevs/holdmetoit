import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
   interface Session {
      user: {
         id: string;
         role: UserRole;
         discordId: string | null;
         displayName: string | null;
         username: string | null;
         isSick?: boolean;
         sickModeActivatedAt?: string | null;
         sickModeNote?: string | null;
         sickModeReminderSnoozedUntil?: string | null;
         sickModeLastDeactivatedAt?: string | null;
      } & DefaultSession["user"];
   }

   interface User {
      role: UserRole;
      discordId: string | null;
      displayName: string | null;
      username?: string | null;
      isSick?: boolean;
      sickModeActivatedAt?: Date | string | null;
      sickModeNote?: string | null;
      sickModeReminderSnoozedUntil?: Date | string | null;
      sickModeLastDeactivatedAt?: Date | string | null;
   }
}

export {};
