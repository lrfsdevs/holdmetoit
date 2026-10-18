import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/core/auth";
import { isDevRole } from "@/features/auth/domain/auth-roles";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";

export const metadata = {
   title: "DevBoard | HoldMeToIt",
   description:
      "Runtime feature flags, release toggles, and developer controls.",
};

/** Enforces DEV access and provides shared DevBoard layout chrome. */
export default async function DevBoardLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;
   const isDevBypass =
      process.env.NODE_ENV === "development" || !process.env.AUTH_DISCORD_ID;

   // Strict DEV role check: Non-authenticated and non-DEV users (even ADMINs) are rejected
   if (!session?.user?.id && !isDevBypass) {
      redirect("/");
   }

   if (session?.user && !isDevRole(session.user.role) && !isDevBypass) {
      redirect("/");
   }

   const { isPreviewActive } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
   });

   if (isPreviewActive) {
      redirect("/");
   }

   return (
      <div className="min-h-[calc(100vh-4rem)] bg-surface-page text-text-primary font-sans flex flex-col">
         <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
         </main>
      </div>
   );
}
