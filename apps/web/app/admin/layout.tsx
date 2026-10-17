import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shield, Sparkles, Trophy, UserCheck } from "lucide-react";

import { auth } from "@/core/auth";
import { hasAdminPrivileges } from "@/features/auth/domain/auth-roles";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";

/** Provides admin authorization and shared layout chrome for admin routes. */
export default async function AdminLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;
   const isDevBypass =
      process.env.NODE_ENV === "development" || !process.env.AUTH_DISCORD_ID;

   if (!session?.user?.id && !isDevBypass) {
      redirect("/");
   }

   if (
      session?.user &&
      !hasAdminPrivileges(session.user.role) &&
      !isDevBypass
   ) {
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
      <div className="min-h-[calc(100vh-4rem)] bg-obsidian-bg text-obsidian-text font-sans flex flex-col">
         {/* Main Content Area */}
         <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
         </main>

         {/* Footer */}
         <footer className="relative z-10 border-t border-obsidian-borderSubtle bg-obsidian-bg py-6 text-center text-xs text-obsidian-textDim">
            <div className="mx-auto max-w-7xl px-4">
               HoldMeToIt Host Console • Eliminate Spreadsheet Burnout &
               Automate Study Battles
            </div>
         </footer>
      </div>
   );
}
