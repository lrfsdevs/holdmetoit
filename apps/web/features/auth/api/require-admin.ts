import { auth } from "@/core/auth";
import {
   hasAdminPrivileges,
   type UserRoleType,
} from "@/features/auth/domain/auth-roles";

export class AdminAccessError extends Error {
   readonly code = "FORBIDDEN_NOT_ADMIN";
   constructor(message = "Host administrative permissions required.") {
      super(message);
      this.name = "AdminAccessError";
   }
}

export interface AdminSessionUser {
   id: string;
   username: string;
   displayName: string;
   role: UserRoleType;
}

export async function requireAdminUser(): Promise<AdminSessionUser> {
   const session = await auth();

   if (session?.user?.id) {
      if (hasAdminPrivileges(session.user.role)) {
         const isDev = session.user.role === "DEV";
         return {
            id: session.user.id,
            username:
               session.user.displayName ??
               session.user.name ??
               (isDev ? "Developer" : "HostAdmin"),
            displayName:
               session.user.displayName ??
               session.user.name ??
               (isDev ? "Developer" : "Host Admin"),
            role: session.user.role as UserRoleType,
         };
      }
   }

   throw new AdminAccessError();
}
