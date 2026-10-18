import { auth } from "@/core/auth";

export class AuthError extends Error {
   constructor(message = "You must sign in to continue.") {
      super(message);
      this.name = "AuthError";
   }
}

export async function requireSessionUser() {
   const session = await auth();

   if (!session?.user?.id) {
      throw new AuthError();
   }

   return session.user;
}
