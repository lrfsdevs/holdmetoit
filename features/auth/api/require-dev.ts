import { auth } from "@/core/auth";
import { isDevRole } from "@/features/auth/domain/auth-roles";

export class DevAccessError extends Error {
   readonly code = "FORBIDDEN_NOT_DEV";
   constructor(message = "Developer permissions required.") {
      super(message);
      this.name = "DevAccessError";
   }
}

export interface DevSessionUser {
   id: string;
   username: string;
   displayName: string;
   role: "DEV";
}

export async function requireDevUser(): Promise<DevSessionUser> {
   const session = await auth();

   if (session?.user?.id && isDevRole(session.user.role)) {
      return {
         id: session.user.id,
         username: session.user.displayName ?? session.user.name ?? "Developer",
         displayName:
            session.user.displayName ?? session.user.name ?? "Developer",
         role: "DEV",
      };
   }

   throw new DevAccessError();
}
