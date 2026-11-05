import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/core/env/server";

const SESSION_COOKIE_NAMES = [
   "authjs.session-token",
   "__Secure-authjs.session-token",
   "next-auth.session-token",
   "__Secure-next-auth.session-token",
];

/**
 * Lightweight proxy for early gatekeeping on protected administrative routes.
 * Deflects completely unauthenticated requests before Server Components or
 * database connections are initialized.
 *
 * Fine-grained RBAC (checking ADMIN vs DEV vs PARTICIPANT roles) remains enforced by
 * Server Component layouts and Server Actions using the database-backed session.
 */
export function proxy(request: NextRequest) {
   const env = getServerEnv();
   const { pathname } = request.nextUrl;

   if (pathname.startsWith("/admin") || pathname.startsWith("/devboard")) {
      const isDevBypass =
         env.NODE_ENV === "development" &&
         (env.ALLOW_DEV_BYPASS || !env.AUTH_DISCORD_ID);

      if (isDevBypass) {
         return NextResponse.next();
      }

      const hasSessionCookie = SESSION_COOKIE_NAMES.some(
         (name) =>
            request.cookies.has(name) &&
            Boolean(request.cookies.get(name)?.value)
      );

      if (!hasSessionCookie) {
         const redirectUrl = new URL("/", request.url);
         return NextResponse.redirect(redirectUrl);
      }
   }

   if (pathname === "/profile") {
      const hasSessionCookie = SESSION_COOKIE_NAMES.some(
         (name) =>
            request.cookies.has(name) &&
            Boolean(request.cookies.get(name)?.value)
      );

      if (!hasSessionCookie) {
         const redirectUrl = new URL("/", request.url);
         return NextResponse.redirect(redirectUrl);
      }
   }

   return NextResponse.next();
}

export const config = {
   matcher: ["/admin/:path*", "/devboard/:path*", "/profile"],
};
