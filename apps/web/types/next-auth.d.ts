import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
   interface Session {
      user: {
         id: string;
         role: UserRole;
         discordId: string | null;
         displayName: string | null;
      } & DefaultSession["user"];
   }

   interface User {
      role: UserRole;
      discordId: string | null;
      displayName: string | null;
   }
}

export {};
