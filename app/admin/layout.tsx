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
import { AppHeader } from "@/features/auth/presentation/auth-nav";

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
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] font-sans flex flex-col">
         <AppHeader
            user={session?.user}
            subtitle="Admin Console"
            isActualAdmin={
               hasAdminPrivileges(session?.user?.role) || isDevBypass
            }
            isPreviewActive={false}
         />

         {/* Main Content Area */}
         <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
         </main>

         {/* Footer */}
         <footer className="relative z-10 border-t border-[#1f1f1f] bg-[#0d0d0d] py-6 text-center text-xs text-[#868686]">
            <div className="mx-auto max-w-7xl px-4">
               HoldMeToIt Host Console • Eliminate Spreadsheet Burnout &
               Automate Study Battles
            </div>
         </footer>
      </div>
   );
}
