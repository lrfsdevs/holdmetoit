import { redirect } from "next/navigation";
import { auth } from "@/core/auth";
import { isDevRole } from "@/features/auth/domain/auth-roles";
import { AppHeader } from "@/features/auth/presentation/auth-nav";

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
   const isDevBypass =
      process.env.NODE_ENV === "development" || !process.env.AUTH_DISCORD_ID;

   // Strict DEV role check: Non-authenticated and non-DEV users (even ADMINs) are rejected
   if (!session?.user?.id && !isDevBypass) {
      redirect("/");
   }

   if (session?.user && !isDevRole(session.user.role) && !isDevBypass) {
      redirect("/");
   }

   return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#f4f3f6] font-sans flex flex-col">
         <AppHeader
            user={session?.user}
            isActualAdmin={true}
            isPreviewActive={false}
         />

         <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
            {children}
         </main>
      </div>
   );
}
