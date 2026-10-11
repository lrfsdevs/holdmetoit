import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import { AppHeader } from "@/features/auth/presentation/auth-nav";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";

export default async function ChallengeLayout({
   children,
   params,
}: {
   children: React.ReactNode;
   params: { id: string };
}) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive, effectiveRole } =
      getEffectiveAdminState({
         userRole: session?.user?.role,
         previewCookie,
      });

   const effectiveUser = session?.user
      ? { ...session.user, role: effectiveRole ?? session.user.role }
      : session?.user;

   return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6]">
         <AppHeader
            user={effectiveUser}
            isActualAdmin={isActualAdmin}
            isPreviewActive={isPreviewActive}
            profileUrl={`/profile?challengeId=${params.id}`}
         />

         {/* Main Page Canvas */}
         <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
         </main>
      </div>
   );
}
