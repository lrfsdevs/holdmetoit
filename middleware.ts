import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAMES = [
   "authjs.session-token",
   "__Secure-authjs.session-token",
   "next-auth.session-token",
   "__Secure-next-auth.session-token",
];

/**
 * Lightweight edge middleware for early gatekeeping on protected administrative routes.
 * Deflects completely unauthenticated requests at the network edge before Server Components
 * or database connections are initialized.
 *
 * Fine-grained RBAC (checking ADMIN vs DEV vs PARTICIPANT roles) remains enforced by
 * Server Component layouts and Server Actions using the database-backed session.
 */
export function middleware(request: NextRequest) {
   const { pathname } = request.nextUrl;

   if (pathname.startsWith("/admin") || pathname.startsWith("/devboard")) {
      const isDevBypass =
         process.env.NODE_ENV === "development" &&
         (process.env.ALLOW_DEV_BYPASS === "true" ||
            !process.env.AUTH_DISCORD_ID);

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

   return NextResponse.next();
}

export const config = {
   matcher: ["/admin/:path*", "/devboard/:path*"],
};
